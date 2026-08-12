const { ENV, watchdogHostWarning, WATCHDOG_MIN_INTERVAL_MS } = require("./preflight.js")
const { error: envError } = require("dotenv").config({ path: ENV })
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")
const { composeCommand, runCompose } = require("./compose.js")
const { healthChecks, loopbackHost } = require("../lib/utils/healthChecks.js")
const gatewayHost = require("../lib/utils/gatewayHost.js")
const webhookAlert = require("../lib/utils/webhookAlert.js")
const { readJSON, writeJSON } = require("../lib/utils/jsonFileHandling.js")

const STAGES = ["restart", "reboot"]
const STATE_FILE = path.join(__dirname, "watchdog.state.json")
const POLL_TIMEOUT_MS = 10000
const RESTART_ARGS = ["up", "-d", "--force-recreate"]
const NO_REBOOT = `no reboot command known for platform ${process.platform} — the watchdog cannot recover this host`
const NOTHING_TO_POLL = "no service has both *_ON=true and *_PROXY_ON=true — nothing runs on this host that the gateway routes a health endpoint for"
const NO_PORT = "gateway_PORT is not a usable port — the restart and reboot stages poll the stack at http://127.0.0.1:<gateway_PORT>, so without it every poll would read as an outage and reboot a healthy host"
const NO_HOST = "gateway_HOST is empty — nothing to try for the reachability alert; restart and reboot are unaffected"
const unreadableEnv = ({ code, message }) => `cannot read ${ENV} (${code ?? message}) and watchdog_ON is not set in the environment either — every setting reads as unset, and the watchdog would exit clean while polling nothing`

const checkUrl = () => healthChecks({ localOnly: true, base: loopbackHost() })

const reachUrl = () => (gatewayHost() ? healthChecks({ localOnly: true }) : {})

const envLines =(env = process.env) => ["watchdog_ON", "gateway_HOST"].map(k => `${k} = ${env[k] ?? ""}`)

const numOrDefault = (value, fallback) => value && !Number.isNaN(Number(value)) ? Number(value) : fallback

const settings = () => ({
	enabled: process.env.watchdog_ON === "true",
	intervalMs: Math.max(WATCHDOG_MIN_INTERVAL_MS, numOrDefault(process.env.watchdog_INTERVAL_MS, 60000)),
	threshold: Math.max(1, numOrDefault(process.env.watchdog_FAILURES, 3))
})

const poll = async (urls = checkUrl()) => {
	const results = await Promise.all(Object.entries(urls).map(async ([name, url]) => {
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

const fail = (reason) => {
	console.error(reason)
	process.exitCode = 1
	return false
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
	if (status !== 0) return fail(`\`${argv.join(" ")}\` exited ${status} — this user cannot reboot the host; grant it the privilege listed in the README watchdog section`)
	return true
}

const restart = () => {
	const { status, error } = runCompose(RESTART_ARGS)
	if (error) return fail(error.message)
	if (status !== 0) return fail(`\`${composeCommand(RESTART_ARGS).join(" ")}\` exited ${status ?? "without status"} — the stack was not restarted; check this user's Docker daemon access, listed in the README watchdog section`)
	return true
}

const readState = () => new Promise(resolve =>
	readJSON(STATE_FILE, (_, data) => resolve({ failures: 0, healthy: 0, stage: 0, unreachable: 0, ...data })))

const writeState = (state) => new Promise(resolve => writeJSON(STATE_FILE, state, resolve, ({ message }) => {
	fail(`watchdog: cannot write ${STATE_FILE} (${message}) — the failure count cannot survive this run, so the watchdog will never reach its threshold`)
	resolve()
}))

const alert = (emoji, text) => webhookAlert(`${emoji} Chimera watchdog on ${os.hostname()}: ${text}`)

const act = async (stage, failed) => {
	await alert("⚠️", `${stage === "reboot" ? "rebooting the host" : "restarting the stack"}\n${failed.join("\n")}`)
	return stage === "reboot" ? reboot() : restart()
}

const resetCounts = (state, stage) => writeState({ ...state, failures: 0, healthy: 0, stage })

const recover = (state, threshold) => {
	if (state.failures) console.log("watchdog: healthy again, failure count reset")
	const healthy = state.healthy + 1
	const cleared = healthy >= threshold
	if (cleared && state.stage) console.log(`watchdog: ${healthy} healthy polls in a row, escalation reset to ${STAGES[0]}`)
	return writeState({ ...state, failures: 0, healthy: cleared ? 0 : healthy, stage: cleared ? 0 : state.stage })
}

const reachability = async (state, threshold) => {
	const urls = reachUrl()
	if (!Object.keys(urls).length) return {}
	const base = gatewayHost()
	const alerted = state.unreachable >= threshold
	const failed = await poll(urls)
	if (!failed.length) {
		if (alerted) {
			console.log(`watchdog: ${base} answers again`)
			await alert("✅", `${base} answers again`)
		}
		return { unreachable: 0 }
	}
	const unreachable = state.unreachable + 1
	console.log(`watchdog: ${unreachable}/${threshold} failed polls of ${base} while every service answers here — alert only — ${failed.join(", ")}`)
	if (unreachable >= threshold && !alerted) await alert("⚠️", `every service answers on this host, but ${base} does not, so nobody can reach it. Check DNS, the router and anything proxying in front. Nothing will be restarted or rebooted.\n${failed.join("\n")}`)
	return { unreachable }
}

const runOnce = async () => {
	const { threshold } = settings()
	const urls = checkUrl()
	const failed = await poll(urls)
	const state = await readState()
	if (!failed.length) {
		const reach = await reachability(state, threshold)
		return recover({ ...state, ...reach }, threshold)
	}
	const failures = state.failures + 1
	console.log(`watchdog: ${failures}/${threshold} consecutive failures — ${failed.join(", ")}`)
	if (failures < threshold) return writeState({ ...state, failures, healthy: 0 })
	const total = failed.length === Object.keys(urls).length
	const stage = (total && STAGES[state.stage]) || STAGES[0]
	await resetCounts(state, total ? nextStage(state.stage) : state.stage)
	if (!await act(stage, failed) && stage === STAGES[0]) await resetCounts(state, state.stage)
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
	console.log(Object.values(reachUrl()).join("\n") || (gatewayHost() ? NOTHING_TO_POLL : NO_HOST))
}

const envProblem = (error = envError, env = process.env) => error && !env.watchdog_ON ? unreadableEnv(error) : null

const configProblem = () => {
	const unreadable = envProblem()
	if (unreadable) return unreadable
	if (!settings().enabled) return null
	if (!loopbackHost()) return NO_PORT
	return Object.keys(checkUrl()).length ? null : NOTHING_TO_POLL
}

if (require.main === module) {
	const hostWarning = watchdogHostWarning(envLines())
	if (hostWarning) console.warn(hostWarning)
	if (settings().enabled && !gatewayHost()) console.warn(NO_HOST)
	const dry = process.argv.includes("--dry-run")
	const problem = dry ? null : configProblem()
	if (dry) dryRun()
	else if (problem) fail(problem)
	else if (!settings().enabled) console.log("watchdog_ON is not true — nothing to do")
	else (process.argv.includes("--once") ? runOnce() : loop()).catch(({ message }) => fail(message))
}

module.exports = { STAGES, NO_HOST, NO_PORT, NOTHING_TO_POLL, checkUrl, reachUrl, configProblem, envProblem, envLines, settings, poll, rebootCommand, privileged, nextStage, runOnce, restart, reboot, dryRun }
