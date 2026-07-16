jest.mock("lib", () => ({ isPrimeInstance: true, objectState: { register: jest.fn() }, loadCameras: jest.fn(() => Promise.resolve([])), mapLimit: require("../../lib/utils/mapLimit.js") }))
jest.mock("child_process", () => ({ execFile: jest.fn() }))
jest.mock("fs", () => ({ mkdirSync: jest.fn(), readFileSync: jest.fn(), unlinkSync: jest.fn(), writeFileSync: jest.fn(), readdirSync: jest.fn(), statSync: jest.fn(), promises: { readdir: jest.fn(), stat: jest.fn(), unlink: jest.fn() } }))
jest.mock("../backend/lib/pool.js", () => ({ query: jest.fn() }))
jest.mock("../backend/lib/webhook.js", () => jest.fn())
jest.mock("../backend/lib/detector.js", () => ({ INPUT: 4, detect: jest.fn() }))

const path = require("path")
const fs = require("fs")
const worker = require("../backend/lib/worker.js")

const NOW = 1700000000000

beforeEach(() => {
	jest.clearAllMocks()
	jest.spyOn(Date, "now").mockReturnValue(NOW)
})

afterEach(() => {
	Date.now.mockRestore()
})

describe("sweepTemp", () => {
	test("removes orphaned temp files older than the stale threshold, keeps fresh ones", async () => {
		fs.promises.readdir.mockResolvedValue(["1-100-0.jpg", "1-100-0.raw", "2-200-1.jpg"])
		fs.promises.stat.mockImplementation((p) => {
			const name = path.basename(p)
			const mtimeMs = name.startsWith("1-100-0") ? NOW - 70000 : NOW - 1000
			return Promise.resolve({ mtimeMs })
		})

		await worker.sweepTemp()

		const unlinked = fs.promises.unlink.mock.calls.map((c) => path.basename(c[0])).sort()
		expect(unlinked).toEqual(["1-100-0.jpg", "1-100-0.raw"])
	})

	test("does nothing when the temp directory is empty", async () => {
		fs.promises.readdir.mockResolvedValue([])
		await worker.sweepTemp()
		expect(fs.promises.unlink).not.toHaveBeenCalled()
	})

	test("swallows a stat failure for a file that vanished mid-sweep", async () => {
		fs.promises.readdir.mockResolvedValue(["gone.jpg"])
		fs.promises.stat.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
		await expect(worker.sweepTemp()).resolves.toBeUndefined()
		expect(fs.promises.unlink).not.toHaveBeenCalled()
	})

	test("swallows a readdir failure instead of throwing", async () => {
		fs.promises.readdir.mockRejectedValue(new Error("EACCES"))
		await expect(worker.sweepTemp()).resolves.toBeUndefined()
	})
})
