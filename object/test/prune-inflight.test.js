process.env.object_MAX_CAPTURES = "1"

jest.mock("lib", () => ({ isPrimeInstance: true, objectState: { register: jest.fn() }, loadCameras: jest.fn(() => [{ id: 1, name: "a" }]), mapLimit: require("../../lib/utils/mapLimit.js"), webhookAlert: jest.fn() }))
jest.mock("child_process", () => ({ execFile: jest.fn() }))
jest.mock("fs", () => ({ mkdirSync: jest.fn(), readFileSync: jest.fn(), unlinkSync: jest.fn(), writeFileSync: jest.fn(), readdirSync: jest.fn(), statSync: jest.fn(), promises: { readdir: jest.fn(), stat: jest.fn(), unlink: jest.fn(), writeFile: jest.fn() } }))
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

const MTIME = { "old-high.jpg": 10, "old-low.jpg": 20 }

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

let releaseInsert

beforeEach(() => {
	jest.clearAllMocks()
	process.env.object_ALERT_ON = "false"
	releaseInsert = null
	execFile.mockImplementation((file, args, opts, cb) => cb(null))
	fs.readFileSync.mockReturnValue(Buffer.alloc(SIZE * 3))
	fs.promises.writeFile.mockResolvedValue()
	fs.promises.unlink.mockResolvedValue()
	fs.promises.stat.mockImplementation((p) => Promise.resolve({ mtimeMs: MTIME[path.basename(p)] ?? Date.now() }))
	detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])
	pool.query.mockImplementation((sql) => {
		if (String(sql).startsWith("SELECT")) return Promise.resolve({ rows: [{ image: "old-high.jpg", confidence: "0.95" }, { image: "old-low.jpg", confidence: "0.55" }] })
		if (String(sql).startsWith("INSERT")) return new Promise((r) => { releaseInsert = () => r({}) })
		return Promise.resolve({})
	})
})

afterAll(() => { delete process.env.object_ALERT_ON })

const unlinked = () => fs.promises.unlink.mock.calls.map((c) => path.basename(String(c[0])))
const deleted = () => pool.query.mock.calls.filter((c) => String(c[0]).startsWith("DELETE")).map((c) => c[1][0])

describe("pruneCaptures with a capture in flight", () => {
	test("keeps the just-written capture whose insert has not settled, and still evicts down to MAX_CAPTURES", async () => {
		const scanning = worker.scan(1)
		await settle()
		const fresh = path.basename(String(fs.promises.writeFile.mock.calls[0][0]))
		expect(releaseInsert).toEqual(expect.any(Function))

		fs.promises.readdir.mockResolvedValue(["old-high.jpg", "old-low.jpg", fresh])
		await worker.pruneCaptures()

		expect(unlinked()).toEqual(["old-low.jpg"])
		expect(deleted()).toEqual([["old-low.jpg"]])

		releaseInsert()
		await scanning
	})

	test("releases the capture for pruning once the insert settles", async () => {
		const scanning = worker.scan(1)
		await settle()
		const fresh = path.basename(String(fs.promises.writeFile.mock.calls[0][0]))
		releaseInsert()
		await scanning

		fs.promises.unlink.mockClear()
		pool.query.mockClear()
		pool.query.mockImplementation((sql) => String(sql).startsWith("SELECT")
			? Promise.resolve({ rows: [{ image: "old-high.jpg", confidence: "0.95" }] })
			: Promise.resolve({}))
		fs.promises.readdir.mockResolvedValue(["old-high.jpg", fresh])
		await worker.pruneCaptures()

		expect(unlinked()).toEqual([fresh])
	})
})
