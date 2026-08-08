require("dotenv").config()
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")
const { composeCommand, runCompose } = require("./compose.js")
const gatewayHost = require("../lib/utils/gatewayHost.js")
const webhookAlert = require("../lib/utils/webhookAlert.js")
const { readJSON, writeJSON } = require("../lib/utils/jsonFileHandling.js")

const SERVICES = ["command", "livestream", "object", "schedule", "storage"]
const STAGES = ["restart", "reboot"]
const STATE_FILE = path.join(__dirname, "watchdog.state.json")
const POLL_TIMEOUT_MS = 10000
const RESTART_ARGS = ["restart"]

const checkUrl = () => {
	const baseUrl = gatewayHost()
	return Object.fromEntries(SERVICES.map(s => [s, `${baseUrl}/${s}/health`]))
}

const settings = () => ({
	enabled: process.env.watchdog_ON === "true",
	intervalMs: Number(process.env.watchdog_INTERVAL_MS) || 60000,
	threshold: Number(process.env.watchdog_FAILURES) || 3
})

const poll = async () => {
	const results = await Promise.all(Object.entries(checkUrl()).map(async ([name, url]) => {
		try {
			const { ok, status } = await fetch(url, { signal: AbortSignal.timeout(POLL_TIMEOUT_MS) })
			return ok ? null : `${name} → ${status}`
		} catch ({ message }) {
			return `${name} → ${message}`
		}
	}))
	return results.filter(Boolean)
}

const hasSystemd = () => fs.existsSync("/run/systemd/system")

const rebootCommand = (platform = process.platform, systemd = hasSystemd) =>
	platform === "win32" ? ["shutdown", "/r", "/t", "0"]
		: platform === "darwin" ? ["shutdown", "-r", "now"]
			: platform === "linux" ? (systemd() ? ["systemctl", "reboot"] : ["shutdown", "-r", "now"])
				: null

const privileged = (command, platform = process.platform, uid = process.getuid?.()) =>
	platform === "win32" || uid === 0 ? command : ["sudo", "-n", ...command]

const nextStage = (stage) => (stage + 1) % STAGES.length

const die = (reason) => {
	console.error(reason)
	process.exit(1)
}

const rebootArgv = () => {
	const command = rebootCommand()
	if (!command) die(`no reboot command known for platform ${process.platform} — the watchdog cannot recover this host`)
	return privileged(command)
}

const reboot = () => {
	const argv = rebootArgv()
	const [command, ...args] = argv
	console.log(`watchdog: ${argv.join(" ")}`)
	const { status, error } = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" })
	if (error) die(error.code === "ENOENT"
		? `reboot command not found: ${command}`
		: `reboot command failed: ${error.message}`)
	if (status !== 0) die(`\`${argv.join(" ")}\` exited ${status} — this user cannot reboot the host; grant it the privilege listed in the README watchdog section`)
}

const restart = () => {
	const { status, error } = runCompose(RESTART_ARGS)
	if (error) console.error(error.message)
	if (status !== 0) console.error(`\`${composeCommand(RESTART_ARGS).join(" ")}\` exited ${status ?? "without status"}`)
}

const readState = () => new Promise(resolve =>
	readJSON(STATE_FILE, (_, data) => resolve({ failures: 0, stage: 0, ...data })))

const writeState = (state) => new Promise(resolve => writeJSON(STATE_FILE, state, resolve, resolve))

const act = async (stage, failed) => {
	await webhookAlert(`⚠️ Chimera watchdog on ${os.hostname()}: ${stage === "reboot" ? "rebooting the host" : "restarting the stack"}\n${failed.join("\n")}`)
	if (stage === "reboot") reboot()
	else restart()
}

const runOnce = async () => {
	const { threshold } = settings()
	const failed = await poll()
	const state = await readState()
	if (!failed.length) {
		if (state.failures) console.log("watchdog: healthy again, failure count reset")
		return writeState({ failures: 0, stage: 0 })
	}
	const failures = state.failures + 1
	console.log(`watchdog: ${failures}/${threshold} consecutive failures — ${failed.join(", ")}`)
	if (failures < threshold) return writeState({ ...state, failures })
	const stage = STAGES[state.stage] || STAGES[0]
	await writeState({ failures: 0, stage: nextStage(state.stage) })
	await act(stage, failed)
}

const loop = async () => {
	const { intervalMs } = settings()
	for (;;) {
		await runOnce()
		await new Promise(resolve => setTimeout(resolve, intervalMs))
	}
}

const dryRun = () => {
	console.log(composeCommand(RESTART_ARGS).join(" "))
	console.log(rebootArgv().join(" "))
}

if (require.main === module) {
	if (process.argv.includes("--dry-run")) dryRun()
	else if (!settings().enabled) console.log("watchdog_ON is not true — nothing to do")
	else (process.argv.includes("--once") ? runOnce() : loop()).catch(({ message }) => die(message))
}

module.exports = { STAGES, checkUrl, settings, poll, rebootCommand, privileged, nextStage, runOnce, restart, reboot }
