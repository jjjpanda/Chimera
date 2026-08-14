const fs = require("fs")
const os = require("os")
const path = require("path")

process.env.CHIMERA_UPDATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "chimera-update-"))

jest.mock("child_process", () => ({ spawnSync: jest.fn(() => ({ status: 0 })) }))
jest.mock("../compose.js", () => ({
	composeCommand: jest.fn((args) => ["docker", "compose", ...args]),
	runCompose: jest.fn(() => ({ status: 0 }))
}))
jest.mock("../../lib/utils/webhookAlert.js", () => jest.fn(() => Promise.resolve()))

const { spawnSync } = require("child_process")
const webhookAlert = require("../../lib/utils/webhookAlert.js")
const { ROOT } = require("../preflight.js")
const { DIR, REQUEST, RUNNING, RESULT } = require("../../lib/utils/updateBridge.js")
const { checkUpdateRequest, UPDATE_INTERRUPTED } = require("../watchdog.js")

const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data))
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const clear = () => [REQUEST, RUNNING, RESULT].forEach(file => fs.rmSync(file, { force: true }))

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

	expect(spawnSync).toHaveBeenCalledTimes(2)
	expect(spawnSync.mock.calls[0][0]).toBe("git")
	expect(spawnSync.mock.calls[0][1]).toEqual(["pull"])
	expect(spawnSync.mock.calls[0][2]).toMatchObject({ cwd: ROOT })
	expect(spawnSync.mock.calls[1][1]).toEqual(["run", "docker:rebuild"])
	expect(spawnSync.mock.calls[1][2]).toMatchObject({ cwd: ROOT })
})

// the panel polls while the rebuild runs, and must not read an in-flight update as finished
test("the request becomes a running marker before anything is spawned, and the marker names who asked", async () => {
	write(REQUEST, { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "susan" })
	let markerDuringRun = null
	spawnSync.mockImplementation(() => {
		markerDuringRun = fs.existsSync(RUNNING) ? read(RUNNING) : null
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

	expect(spawnSync).toHaveBeenCalledTimes(1)
	expect(read(RESULT)).toMatchObject({ success: false })
	expect(read(RESULT).message).toContain("git pull")
})

test("a rebuild that could not run is reported rather than counted as an update", async () => {
	write(REQUEST, { requestedBy: "susan" })
	spawnSync.mockReturnValueOnce({ status: 0 }).mockReturnValueOnce({ error: new Error("spawn npm ENOENT") })

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
	expect(spawnSync).toHaveBeenCalledTimes(2)
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

	expect(spawnSync).toHaveBeenCalledTimes(2)
	expect(fs.existsSync(REQUEST)).toBe(false)
})
