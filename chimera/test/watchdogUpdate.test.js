const fs = require("fs")
const os = require("os")
const path = require("path")

process.env.CHIMERA_UPDATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "chimera-update-"))
process.env.CHIMERA_ENV_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "chimera-env-")), ".env")

jest.mock("child_process", () => ({ spawnSync: jest.fn(() => ({ status: 0 })) }))
jest.mock("../compose.js", () => ({
	composeCommand: jest.fn((args) => ["docker", "compose", ...args]),
	runCompose: jest.fn(() => ({ status: 0 }))
}))
jest.mock("../../lib/utils/webhookAlert.js", () => jest.fn(() => Promise.resolve()))

const { spawnSync } = require("child_process")
const webhookAlert = require("../../lib/utils/webhookAlert.js")
const { ROOT, ENV } = require("../preflight.js")
const { DIR, REQUEST, RUNNING, RESULT, VERSION } = require("../../lib/utils/updateBridge.js")
const { checkUpdateRequest, refreshVersions, recoverOrFail, UPDATE_INTERRUPTED, majorHeld, NO_PORT } = require("../watchdog.js")
const { version: LOCAL } = require("../../package.json")

const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data))
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const clear = () => [REQUEST, RUNNING, RESULT, VERSION].forEach(file => fs.rmSync(file, { force: true }))

const bumped = (index) => LOCAL.split(".").map((n, i) => i === index ? Number(n) + 1 : i > index ? 0 : n).join(".")

// the version probe spawns git too, so the update steps are what is left once it is filtered out
const PROBE = ["rev-parse", "fetch", "show"]
const steps = () => spawnSync.mock.calls.filter(([command, args]) => !(command === "git" && PROBE.includes(args[0])))

const remoteIs = (version) => spawnSync.mockImplementation((command, args) => {
	if (command !== "git") return { status: 0 }
	if (args[0] === "rev-parse") return { status: 0, stdout: "origin/develop\n" }
	if (args[0] === "show") return { status: 0, stdout: JSON.stringify({ version }) }
	return { status: 0 }
})

beforeEach(() => {
	fs.mkdirSync(DIR, { recursive: true })
	clear()
	spawnSync.mockReset().mockReturnValue({ status: 0 })
	webhookAlert.mockClear()
	jest.spyOn(console, "log").mockImplementation(() => {})
	jest.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
	process.exitCode = undefined
	jest.restoreAllMocks()
})

afterAll(() => {
	fs.rmSync(DIR, { recursive: true, force: true })
})

test("no request means no update, and the poll that follows still runs", async () => {
	expect(await checkUpdateRequest()).toBe(false)
	expect(spawnSync).not.toHaveBeenCalled()
	expect(fs.existsSync(RESULT)).toBe(false)
})

test("a request pulls and rebuilds from the repo root, in that order", async () => {
	write(REQUEST, { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "susan" })

	expect(await checkUpdateRequest()).toBe(true)

	expect(steps()).toHaveLength(2)
	expect(steps()[0][0]).toBe("git")
	expect(steps()[0][1]).toEqual(["pull"])
	expect(steps()[0][2]).toMatchObject({ cwd: ROOT, timeout: 30000, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: "0" }) })
	expect(steps()[1][1]).toEqual(["run", "docker:rebuild"])
	expect(steps()[1][2]).toMatchObject({ cwd: ROOT })
})

// the panel polls while the rebuild runs, and must not read an in-flight update as finished
test("the request becomes a running marker before anything is spawned, and the marker names who asked", async () => {
	write(REQUEST, { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "susan" })
	let markerDuringRun = null
	spawnSync.mockImplementation(() => {
		markerDuringRun ??= fs.existsSync(RUNNING) ? read(RUNNING) : null
		return { status: 0 }
	})

	await checkUpdateRequest()

	expect(markerDuringRun).toMatchObject({ requestedBy: "susan" })
	expect(markerDuringRun.startedAt).toEqual(expect.any(String))
	expect(fs.existsSync(REQUEST)).toBe(false)
	expect(fs.existsSync(RUNNING)).toBe(false)
})

test("a finished update leaves a success result and alerts both ends of it", async () => {
	write(REQUEST, { requestedBy: "susan" })

	await checkUpdateRequest()

	expect(read(RESULT)).toMatchObject({ success: true })
	expect(webhookAlert).toHaveBeenCalledTimes(2)
	expect(webhookAlert.mock.calls[0][0]).toContain("susan")
	expect(webhookAlert.mock.calls[1][0]).toContain("update finished")
})

test("a failed pull is reported without rebuilding a tree that never changed", async () => {
	write(REQUEST, { requestedBy: "susan" })
	spawnSync.mockReturnValue({ status: 1 })

	await checkUpdateRequest()

	expect(steps()).toHaveLength(1)
	expect(read(RESULT)).toMatchObject({ success: false })
	expect(read(RESULT).message).toContain("git pull")
})

test("a rebuild that could not run is reported rather than counted as an update", async () => {
	write(REQUEST, { requestedBy: "susan" })
	// the version probe takes the first call, the pull the second, the rebuild the third
	spawnSync.mockReturnValueOnce({ status: 0 }).mockReturnValueOnce({ status: 0 }).mockReturnValueOnce({ error: new Error("spawn npm ENOENT") })

	await checkUpdateRequest()

	expect(read(RESULT)).toMatchObject({ success: false })
	expect(read(RESULT).message).toContain("spawn npm ENOENT")
})

// only a watchdog killed mid-rebuild leaves this behind: spawnSync blocks until the update ends
test("a marker left by a killed watchdog ends as a failure instead of pinning the panel to running", async () => {
	write(RUNNING, { requestedBy: "susan", startedAt: "2026-08-13T00:00:00.000Z" })

	expect(await checkUpdateRequest()).toBe(true)

	expect(spawnSync).not.toHaveBeenCalled()
	expect(fs.existsSync(RUNNING)).toBe(false)
	expect(read(RESULT)).toMatchObject({ success: false, message: UPDATE_INTERRUPTED })
})

test("a request that arrives during an interrupted update is kept for the next pass", async () => {
	write(RUNNING, { requestedBy: "susan" })
	write(REQUEST, { requestedBy: "alex" })

	await checkUpdateRequest()

	expect(fs.existsSync(REQUEST)).toBe(true)
	expect(await checkUpdateRequest()).toBe(true)
	expect(steps()).toHaveLength(2)
})

// a bridge write that keeps failing must not pin the watchdog to skipping every poll forever
test("a result that cannot be written still clears the running marker", async () => {
	write(RUNNING, { requestedBy: "susan" })
	fs.mkdirSync(RESULT)

	expect(await checkUpdateRequest()).toBe(true)

	expect(fs.existsSync(RUNNING)).toBe(false)
	fs.rmdirSync(RESULT)
})

test("a claim that cannot be enriched with startedAt still runs the update instead of stalling every pass", async () => {
	write(REQUEST, { requestedBy: "susan" })
	const realWriteFile = fs.writeFile.bind(fs)
	jest.spyOn(fs, "writeFile").mockImplementation((file, data, cb) =>
		file === RUNNING ? cb(new Error("EACCES: permission denied")) : realWriteFile(file, data, cb))

	expect(await checkUpdateRequest()).toBe(true)

	expect(steps()).toHaveLength(2)
	expect(fs.existsSync(REQUEST)).toBe(false)
})

describe("versions", () => {
	test("a major bump is held instead of pulled, and the panel is told what to confirm", async () => {
		const to = bumped(0)
		remoteIs(to)
		write(REQUEST, { requestedBy: "susan" })

		expect(await checkUpdateRequest()).toBe(true)

		expect(steps()).toHaveLength(0)
		expect(read(RESULT)).toMatchObject({ success: false, blocked: true, from: LOCAL, to, message: majorHeld(LOCAL, to) })
		expect(fs.existsSync(RUNNING)).toBe(false)
		expect(webhookAlert.mock.calls[0][0]).toContain("held")
	})

	test("a major bump the admin confirmed is pulled like any other", async () => {
		remoteIs(bumped(0))
		write(REQUEST, { requestedBy: "susan", allowMajor: true })

		await checkUpdateRequest()

		expect(steps()).toHaveLength(2)
		expect(read(RESULT)).toMatchObject({ success: true })
		expect(read(RESULT).blocked).toBeUndefined()
	})

	test("a minor bump needs no confirmation", async () => {
		const to = bumped(1)
		remoteIs(to)
		write(REQUEST, { requestedBy: "susan" })

		await checkUpdateRequest()

		expect(steps()).toHaveLength(2)
		expect(read(RESULT)).toMatchObject({ success: true, from: LOCAL, to })
	})

	// a remote nobody can reach must not become a gate that no confirmation can open
	test("an unreadable remote version leaves the update ungated", async () => {
		spawnSync.mockReturnValue({ status: 1 })
		write(REQUEST, { requestedBy: "susan" })

		await checkUpdateRequest()

		expect(read(VERSION)).toMatchObject({ current: LOCAL, available: null })
		expect(steps()[0][1]).toEqual(["pull"])
	})

	test("the published pair is reused until it goes stale, so the remote is not hit every poll", async () => {
		remoteIs(bumped(2))

		await refreshVersions()
		const first = spawnSync.mock.calls.length
		await refreshVersions()

		expect(spawnSync.mock.calls).toHaveLength(first)
		expect(read(VERSION)).toMatchObject({ current: LOCAL, available: bumped(2) })
	})

	test("a request re-reads the remote rather than gating on an hour-old answer", async () => {
		write(VERSION, { current: LOCAL, available: LOCAL, at: new Date().toISOString() })
		remoteIs(bumped(0))
		write(REQUEST, { requestedBy: "susan" })

		await checkUpdateRequest()

		expect(read(RESULT)).toMatchObject({ blocked: true, to: bumped(0) })
	})
})

describe("recoverOrFail", () => {
	const ENV_KEYS = ["watchdog_ON", "gateway_PORT", "command_ON", "command_PROXY_ON"]
	let saved

	beforeEach(() => {
		saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]))
		process.env.watchdog_ON = "true"
		process.env.command_ON = "true"
		process.env.command_PROXY_ON = "true"
	})

	afterEach(() => {
		for (const k of ENV_KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])
		fs.rmSync(ENV, { force: true })
	})

	// commit 131efe4 made an update request skip on NO_PORT specifically — dropped per review
	test("a waiting request is still serviced when the config problem is NO_PORT", async () => {
		process.env.gateway_PORT = ""
		write(REQUEST, { requestedBy: "susan" })

		await recoverOrFail(NO_PORT)

		expect(fs.existsSync(REQUEST)).toBe(false)
		expect(read(RESULT)).toMatchObject({ success: true })
	})

	test("a config problem the update did not clear still fails instead of looping", async () => {
		process.env.gateway_PORT = ""

		expect(await recoverOrFail(NO_PORT)).toBe(false)

		expect(console.error).toHaveBeenCalledWith(NO_PORT)
		expect(process.exitCode).toBe(1)
	})

	test("a config problem the update cleared re-enters the loop instead of failing", async () => {
		process.env.gateway_PORT = ""
		fs.writeFileSync(ENV, "gateway_PORT=8080\n")

		expect(await recoverOrFail(NO_PORT)).toBe(true)

		expect(console.error).not.toHaveBeenCalled()
	})
})
