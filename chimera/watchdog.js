const { ENV, readLines, watchdogHostWarning, WATCHDOG_MIN_INTERVAL_MS } = require("./preflight.js")
require("dotenv").config({ path: ENV })
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")
const { composeCommand, runCompose } = require("./compose.js")
const checkUrl = require("../lib/utils/healthChecks.js")
const webhookAlert = require("../lib/utils/webhookAlert.js")
const { readJSON, writeJSON } = require("../lib/utils/jsonFileHandling.js")

const STAGES = ["restart", "reboot"]
const STATE_FILE = path.join(__dirname, "watchdog.state.json")
const POLL_TIMEOUT_MS = 10000
// plain `restart` exits 0 without doing anything once the containers are gone
const RESTART_ARGS = ["up", "-d", "--force-recreate"]
const NO_REBOOT = `no reboot command known for platform ${process.platform} — the watchdog cannot recover this host`
const NOTHING_TO_POLL = "no service has *_PROXY_ON=true — the gateway routes no health endpoint to watch"

const settings = () => ({
	enabled: process.env.watchdog_ON === "true",
	// nothing runs preflight before `npm run watchdog`, so the floor has to hold here too
	intervalMs: Math.max(WATCHDOG_MIN_INTERVAL_MS, Number(process.env.watchdog_INTERVAL_MS) || 60000),
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

// a stage that cannot run must not take the loop down with it — the other stage may still work
const fail = (reason) => {
	console.error(reason)
	process.exitCode = 1
}

const rebootArgv = () => {
	const command = rebootCommand()
	return command && privileged(command)
}

const reboot = () => {
	const argv = rebootArgv()
	if (!argv) return fail(NO_REBOOT)
	const [command, ...args] = argv
	console.log(`watchdog: ${argv.join(" ")}`)
	const { status, error } = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" })
	if (error) return fail(error.code === "ENOENT"
		? `reboot command not found: ${command}`
		: `reboot command failed: ${error.message}`)
	if (status !== 0) fail(`\`${argv.join(" ")}\` exited ${status} — this user cannot reboot the host; grant it the privilege listed in the README watchdog section`)
}

const restart = () => {
	const { status, error } = runCompose(RESTART_ARGS)
	if (error) return fail(error.message)
	if (status !== 0) fail(`\`${composeCommand(RESTART_ARGS).join(" ")}\` exited ${status ?? "without status"} — the stack was not restarted; check this user's Docker daemon access, listed in the README watchdog section`)
}

const readState = () => new Promise(resolve =>
	readJSON(STATE_FILE, (_, data) => resolve({ failures: 0, stage: 0, ...data })))

const writeState = (state) => new Promise(resolve => writeJSON(STATE_FILE, state, resolve, ({ message }) => {
	fail(`watchdog: cannot write ${STATE_FILE} (${message}) — the failure count cannot survive this run, so the watchdog will never reach its threshold`)
	resolve()
}))

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
	const argv = rebootArgv()
	console.log(composeCommand(RESTART_ARGS).join(" "))
	console.log(argv ? argv.join(" ") : NO_REBOOT)
	console.log(Object.values(checkUrl()).join("\n") || NOTHING_TO_POLL)
}

if (require.main === module) {
	const schemeWarning = watchdogHostWarning(readLines())
	if (schemeWarning) console.warn(schemeWarning)
	if (process.argv.includes("--dry-run")) dryRun()
	else if (!settings().enabled) console.log("watchdog_ON is not true — nothing to do")
	else if (!Object.keys(checkUrl()).length) console.log(NOTHING_TO_POLL)
	else (process.argv.includes("--once") ? runOnce() : loop()).catch(({ message }) => fail(message))
}

module.exports = { STAGES, checkUrl, settings, poll, rebootCommand, privileged, nextStage, runOnce, restart, reboot }
