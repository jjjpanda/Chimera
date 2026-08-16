const { ENV, ROOT, watchdogHostWarning, WATCHDOG_MIN_INTERVAL_MS } = require("./preflight.js")
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
const { REQUEST, RUNNING, RESULT, VERSION, HEARTBEAT, HEARTBEAT_MAX_AGE_MS, majorBump } = require("../lib/utils/updateBridge.js")

const STAGES = ["restart", "reboot"]
const STATE_FILE = path.join(__dirname, "watchdog.state.json")
const POLL_TIMEOUT_MS = 10000
const RESTART_ARGS = ["up", "-d", "--force-recreate"]
const NO_REBOOT = `no reboot command known for platform ${process.platform} — the watchdog cannot recover this host`
const NOTHING_TO_POLL = "no service has both *_ON=true and *_PROXY_ON=true — nothing runs on this host that the gateway routes a health endpoint for"
const NO_PORT = "gateway_PORT is not a usable port — the restart and reboot stages poll the stack at http://127.0.0.1:<gateway_PORT>, so without it every poll would read as an outage and reboot a healthy host"
const NO_HOST = "gateway_HOST is empty — nothing to try for the reachability alert; restart and reboot are unaffected"
const unreadableEnv = ({ code, message }) => `cannot read ${ENV} (${code ?? message}) — settings from .env are unavailable; gateway_PORT and other variables must come from the environment`

const checkUrl = () => healthChecks({ localOnly: true, base: loopbackHost() })

const reachUrl = () => (gatewayHost() ? healthChecks({ localOnly: true }) : {})

const envLines =(env = process.env) => ["gateway_HOST"].map(k => `${k} = ${env[k] ?? ""}`)

const numOrDefault = (value, fallback) => value && !Number.isNaN(Number(value)) ? Number(value) : fallback

const settings = () => ({
	intervalMs: Math.min(HEARTBEAT_MAX_AGE_MS, Math.max(WATCHDOG_MIN_INTERVAL_MS, numOrDefault(process.env.watchdog_INTERVAL_MS, 60000))),
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

const UPDATE_INTERRUPTED = "the watchdog stopped while an update was running — check `git log` and `docker compose ps` before trying again"
const VERSION_REFRESH_MS = 3600000
const GIT_TIMEOUT_MS = 30000
const majorHeld = (from, to) => `major version bump ${from} → ${to} — it can need steps a rebuild does not do, so it has to be confirmed in the admin panel`

const readUpdate = (file) => new Promise(resolve => readJSON(file, (err, data) => resolve(err ? null : data)))

const writeUpdate = (file, data) => new Promise(resolve => writeJSON(file, data, () => resolve(true), ({ message }) => {
	fail(`watchdog: cannot write ${file} (${message}) — the admin panel cannot see what happened to the update`)
	resolve(false)
}))

const clearUpdate = (file) => {
	try {
		fs.unlinkSync(file)
		return true
	} catch ({ code, message }) {
		if (code === "ENOENT") return true
		fail(`watchdog: cannot remove ${file} (${message}) — the admin panel will keep reporting an update that already ended`)
		return false
	}
}

const claimRequest = () => {
	try {
		fs.renameSync(REQUEST, RUNNING)
		return true
	} catch ({ code, message }) {
		if (code !== "ENOENT") fail(`watchdog: cannot claim ${REQUEST} (${message})`)
		return false
	}
}

// timed out, since a fetch that stops to ask for credentials would hang the whole loop
const git = (args) => {
	const { status, stdout } = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", timeout: GIT_TIMEOUT_MS })
	return status === 0 ? (stdout ?? "").trim() : null
}

const versionIn = (json) => {
	try {
		return JSON.parse(json).version ?? null
	} catch {
		return null
	}
}

const localVersion = () => {
	try {
		return versionIn(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))
	} catch {
		return null
	}
}

const remoteVersion = () => {
	const upstream = git(["rev-parse", "--abbrev-ref", "@{u}"])
	if (!upstream || git(["fetch", "--quiet"]) === null) return null
	return versionIn(git(["show", `${upstream}:package.json`]) ?? "")
}

/**
 * Publishes `{ current, available }` to the bridge so the panel can name the
 * bump before an admin asks for it. Throttled, since a fetch every poll would
 * hit the remote once a minute; `force` is for the request itself, which must
 * never gate on an hour-old answer.
 */
const refreshVersions = async (force) => {
	const cached = await readUpdate(VERSION)
	if (!force && cached?.at && Date.now() - Date.parse(cached.at) < VERSION_REFRESH_MS) return cached
	const versions = { current: localVersion(), available: remoteVersion(), at: new Date().toISOString() }
	await writeUpdate(VERSION, versions)
	return versions
}

const runStep = (command, args, options = {}) => {
	console.log(`watchdog: ${[command, ...args].join(" ")}`)
	const { status, error } = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32", ...options })
	if (error) return `\`${[command, ...args].join(" ")}\` could not run: ${error.message}`
	if (status !== 0) return `\`${[command, ...args].join(" ")}\` exited ${status ?? "without status"}`
	return null
}

// a git pull that stops to ask for credentials would otherwise hang the loop with no timeout to save it
const update = () => runStep("git", ["pull"], { timeout: GIT_TIMEOUT_MS, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } })
	?? runStep(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "docker:rebuild"])

const endUpdate = async (problem, extra = {}) => {
	await writeUpdate(RESULT, { success: !problem, message: problem ?? "updated and rebuilt", at: new Date().toISOString(), ...extra })
	await alert(problem ? "⚠️" : "✅", problem ? `update ${extra.blocked ? "held" : "failed"} — ${problem}` : "update finished, the stack was rebuilt")
	return clearUpdate(RUNNING)
}

const checkUpdateRequest = async () => {
	if (fs.existsSync(RUNNING)) {
		await endUpdate(UPDATE_INTERRUPTED)
		return false
	}
	if (!claimRequest()) return false
	const request = await readUpdate(RUNNING) ?? {}
	await writeUpdate(RUNNING, { ...request, startedAt: new Date().toISOString() })
	const { current: from, available: to } = await refreshVersions(true)
	if (majorBump({ current: from, available: to }) && !request.allowMajor) {
		await endUpdate(majorHeld(from, to), { blocked: true, from, to })
		return false
	}
	await alert("🔄", `update requested by ${request.requestedBy ?? "an admin"} — pulling and rebuilding, the stack goes down for it`)
	const problem = update()
	await endUpdate(problem, { from, to })
	if (!problem) await refreshVersions(true)
	return true
}

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
	// only a pull-and-rebuild actually takes the stack down, so that is the only case this pass polls nothing for
	if (await checkUpdateRequest()) return
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

const writeHeartbeat = () => writeUpdate(HEARTBEAT, { at: new Date().toISOString(), pid: process.pid })

const gitRemoteReady = () =>
	git(["remote", "get-url", "origin"]) ? null : "no git remote configured — updates will fail until one is added (`git remote add origin <url>`)"

const loop = async () => {
	const { intervalMs } = settings()
	for (;;) {
		await writeHeartbeat()
		await refreshVersions()
		await runOnce()
		await new Promise(resolve => setTimeout(resolve, intervalMs))
	}
}

const dryRun = () => {
	const argv = rebootArgv()
	console.log(composeCommand(RESTART_ARGS).join(" "))
	console.log(argv ? argv.join(" ") : NO_REBOOT)
	console.log(loopbackHost() ? Object.values(checkUrl()).join("\n") || NOTHING_TO_POLL : NO_PORT)
	console.log(Object.values(reachUrl()).join("\n") || (gatewayHost() ? NOTHING_TO_POLL : NO_HOST))
}

const envProblem = (error = envError) => error ? unreadableEnv(error) : null

// an update can fix the problem (eg. a bad .env), so the loop restarts instead of exiting on a problem that no longer exists
const recoverOrFail = async (problem) => {
	await checkUpdateRequest()
	require("dotenv").config({ path: ENV, override: true })
	if (configProblem()) return fail(problem)
	return true
}

const configProblem = () => {
	const unreadable = envProblem()
	if (unreadable) console.warn(unreadable)
	if (!loopbackHost()) return NO_PORT
	return Object.keys(checkUrl()).length ? null : NOTHING_TO_POLL
}

if (require.main === module) {
	const hostWarning = watchdogHostWarning(envLines())
	if (hostWarning) console.warn(hostWarning)
	if (!gatewayHost()) console.warn(NO_HOST)
	const gitWarning = gitRemoteReady()
	if (gitWarning) console.warn(`WARNING: ${gitWarning}`)
	const dry = process.argv.includes("--dry-run")
	const problem = dry ? null : configProblem()
	const run = () => process.argv.includes("--once") ? writeHeartbeat().then(() => refreshVersions()).then(runOnce) : loop()
	if (dry) dryRun()
	else if (problem) recoverOrFail(problem).then(recovered => recovered && run()).catch(({ message }) => fail(message))
	else run().catch(({ message }) => fail(message))
}

module.exports = { STAGES, NO_HOST, NO_PORT, NOTHING_TO_POLL, UPDATE_INTERRUPTED, majorHeld, checkUrl, reachUrl, configProblem, envProblem, envLines, settings, poll, rebootCommand, privileged, nextStage, runOnce, restart, reboot, dryRun, checkUpdateRequest, refreshVersions, recoverOrFail, writeHeartbeat, gitRemoteReady }
