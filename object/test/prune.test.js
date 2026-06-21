process.env.object_MAX_CAPTURES = "2"

jest.mock("lib", () => ({ isPrimeInstance: true }))
jest.mock("child_process", () => ({ execFile: jest.fn() }))
jest.mock("fs", () => ({ mkdirSync: jest.fn(), readFileSync: jest.fn(), unlinkSync: jest.fn(), writeFileSync: jest.fn(), readdirSync: jest.fn(), statSync: jest.fn() }))
jest.mock("../backend/lib/pool.js", () => ({ query: jest.fn() }))
jest.mock("../backend/lib/webhook.js", () => jest.fn())
jest.mock("../backend/lib/detector.js", () => ({ INPUT: 4, detect: jest.fn() }))

const path = require("path")
const { execFile } = require("child_process")
const fs = require("fs")
const pool = require("../backend/lib/pool.js")
const detector = require("../backend/lib/detector.js")
const worker = require("../backend/lib/worker.js")

const SIZE = detector.INPUT * detector.INPUT

const MTIME = { "a.jpg": 100, "b.jpg": 50, "c.jpg": 10, "d.jpg": 90 }

beforeEach(() => {
	jest.clearAllMocks()
	process.env.object_ALERT_ON = "false"
	execFile.mockImplementation((file, args, opts, cb) => cb(null))
	fs.readFileSync.mockReturnValue(Buffer.alloc(SIZE * 3))
	fs.readdirSync.mockReturnValue(["a.jpg", "b.jpg", "c.jpg", "d.jpg"])
	fs.statSync.mockImplementation((p) => ({ mtimeMs: MTIME[path.basename(p)] }))
	detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])
	pool.query.mockImplementation((sql) => sql.startsWith("SELECT")
		? Promise.resolve({ rows: [
			{ image: "a.jpg", confidence: "0.95" },
			{ image: "b.jpg", confidence: "0.55" },
			{ image: "d.jpg", confidence: "0.85" },
		] })
		: Promise.resolve({}))
})

afterAll(() => { delete process.env.object_ALERT_ON })

describe("pruneCaptures (via scan)", () => {
	test("evicts lowest confidence tier first, oldest mtime as tiebreak, beyond MAX_CAPTURES", async () => {
		await worker.scan(1)

		const captures = new Set(["a.jpg", "b.jpg", "c.jpg", "d.jpg"])
		const unlinked = fs.unlinkSync.mock.calls
			.map((c) => path.basename(c[0]))
			.filter((n) => captures.has(n))
		expect(unlinked).toEqual(["c.jpg", "b.jpg"])

		const del = pool.query.mock.calls.find((c) => String(c[0]).startsWith("DELETE"))
		expect(del[1]).toEqual([["c.jpg", "b.jpg"]])
	})
})
