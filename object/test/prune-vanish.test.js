process.env.object_MAX_CAPTURES = "4"

jest.mock("lib", () => ({ isPrimeInstance: true, objectState: { register: jest.fn() }, loadCameras: jest.fn(() => [{ id: 1, name: "a" }]), mapLimit: require("../../lib/utils/mapLimit.js") }))
jest.mock("child_process", () => ({ execFile: jest.fn() }))
jest.mock("fs", () => ({ mkdirSync: jest.fn(), readFileSync: jest.fn(), unlinkSync: jest.fn(), writeFileSync: jest.fn(), readdirSync: jest.fn(), statSync: jest.fn(), promises: { readdir: jest.fn(), stat: jest.fn(), unlink: jest.fn() } }))
jest.mock("../backend/lib/pool.js", () => ({ query: jest.fn() }))
jest.mock("../backend/lib/webhook.js", () => jest.fn())
jest.mock("../backend/lib/detector.js", () => ({ INPUT: 4, detect: jest.fn() }))

const path = require("path")
const fs = require("fs")
const pool = require("../backend/lib/pool.js")
const worker = require("../backend/lib/worker.js")

beforeEach(() => {
	jest.clearAllMocks()
	pool.query.mockResolvedValue({ rows: [] })
})

describe("pruneCaptures when files vanish mid-sweep", () => {
	test("does not delete survivors when statSync failures drop the count below MAX_CAPTURES", async () => {
		fs.promises.readdir.mockResolvedValue(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"])
		const gone = new Set(["d.jpg", "e.jpg"])
		fs.promises.stat.mockImplementation((p) => {
			if (gone.has(path.basename(p))) { const err = new Error("ENOENT"); err.code = "ENOENT"; return Promise.reject(err) }
			return Promise.resolve({ mtimeMs: 100 })
		})

		await worker.pruneCaptures()

		expect(fs.promises.unlink).not.toHaveBeenCalled()
		expect(pool.query.mock.calls.some((c) => String(c[0]).startsWith("DELETE"))).toBe(false)
	})
})
