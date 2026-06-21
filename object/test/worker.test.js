jest.mock("lib", () => ({ isPrimeInstance: true }))
jest.mock("child_process", () => ({ execFile: jest.fn() }))
jest.mock("fs", () => ({ mkdirSync: jest.fn(), readFileSync: jest.fn(), unlinkSync: jest.fn(), writeFileSync: jest.fn(), readdirSync: jest.fn(() => []), statSync: jest.fn(() => ({ mtimeMs: 0 })) }))
jest.mock("../backend/lib/pool.js", () => ({ query: jest.fn() }))
jest.mock("../backend/lib/webhook.js", () => jest.fn())
jest.mock("../backend/lib/detector.js", () => ({ INPUT: 4, detect: jest.fn() }))

const path = require("path")
const { execFile } = require("child_process")
const fs = require("fs")
const pool = require("../backend/lib/pool.js")
const sendWebhook = require("../backend/lib/webhook.js")
const detector = require("../backend/lib/detector.js")
const worker = require("../backend/lib/worker.js")

const SIZE = detector.INPUT * detector.INPUT

const makeRaw = () => {
	const raw = Buffer.alloc(SIZE * 3)
	raw[0] = 10
	raw[1] = 20
	raw[2] = 30
	raw[3] = 40
	raw[4] = 50
	raw[5] = 60
	return raw
}

beforeEach(() => {
	process.env.alert_URL = "http://hook.test"
	delete process.env.object_ALERT_ON
	execFile.mockImplementation((file, args, opts, cb) => cb(null))
	fs.readFileSync.mockImplementation((p) => String(p).endsWith(".raw") ? makeRaw() : Buffer.from("jpeg"))
	pool.query.mockResolvedValue({})
	sendWebhook.mockResolvedValue()
})

describe("toTensor (bgr24 -> planar BGR float32)", () => {
	test("splits interleaved bgr bytes into B, G, R planes", () => {
		const data = worker.toTensor(makeRaw())
		expect(data).toHaveLength(3 * SIZE)
		expect(data[0]).toBe(10)
		expect(data[SIZE]).toBe(20)
		expect(data[2 * SIZE]).toBe(30)
		expect(data[1]).toBe(40)
		expect(data[SIZE + 1]).toBe(50)
		expect(data[2 * SIZE + 1]).toBe(60)
	})
})

describe("cameraCount", () => {
	test("counts the cameras JSON array", () => {
		process.env.cameras = JSON.stringify(["a", "b", "c"])
		expect(worker.cameraCount()).toBe(3)
	})

	test("returns 0 for malformed cameras", () => {
		process.env.cameras = "not json"
		expect(worker.cameraCount()).toBe(0)
	})
})

describe("scan", () => {
	test("feeds a BGR planar tensor to the detector", async () => {
		detector.detect.mockResolvedValue([])
		await worker.scan(1)
		const tensor = detector.detect.mock.calls[0][0]
		expect(tensor[0]).toBe(10)
		expect(tensor[SIZE]).toBe(20)
		expect(tensor[2 * SIZE]).toBe(30)
	})

	test("inserts + webhooks all detections", async () => {
		detector.detect.mockResolvedValue([
			{ class: "person", score: 0.8765432, box: [0, 0, 1, 1] },
			{ class: "car", score: 0.99, box: [0, 0, 1, 1] }
		])
		const detections = await worker.scan(2)
		expect(detections).toHaveLength(2)
		expect(pool.query).toHaveBeenCalledTimes(2)
		expect(pool.query).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO objects_detected"),
			[2, "person", 0.876543, "[0,0,1,1]", expect.stringMatching(/^2-\d+\.jpg$/)]
		)
		expect(pool.query).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO objects_detected"),
			[2, "car", 0.99, "[0,0,1,1]", expect.stringMatching(/^2-\d+\.jpg$/)]
		)
		expect(sendWebhook).toHaveBeenCalledWith(
			"http://hook.test",
			expect.stringContaining("person (88%)"),
			expect.any(Buffer)
		)
		expect(worker.getStatus()[2].error).toBeNull()
		expect(worker.getStatus()[2].lastDetection.detections).toHaveLength(2)
	})

	test("single detection inserts + webhooks", async () => {
		detector.detect.mockResolvedValue([{ class: "car", score: 0.9, box: [0, 0, 1, 1] }])
		const detections = await worker.scan(3)
		expect(detections).toHaveLength(1)
		expect(pool.query).toHaveBeenCalledTimes(1)
		expect(sendWebhook).toHaveBeenCalledTimes(1)
		expect(worker.getStatus()[3].error).toBeNull()
	})

	test("object_ALERT_ON=false suppresses the webhook but still inserts", async () => {
		process.env.object_ALERT_ON = "false"
		detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])
		await worker.scan(5)
		expect(pool.query).toHaveBeenCalledTimes(1)
		expect(sendWebhook).not.toHaveBeenCalled()
		delete process.env.object_ALERT_ON
	})

	test("records ffmpeg failure in status and returns []", async () => {
		execFile.mockImplementation((file, args, opts, cb) => cb(new Error("ffmpeg boom")))
		const detections = await worker.scan(4)
		expect(detections).toEqual([])
		expect(detector.detect).not.toHaveBeenCalled()
		expect(worker.getStatus()[4].error).toBe("ffmpeg boom")
	})

	test("passes a timeout and SIGKILL to execFile", async () => {
		detector.detect.mockResolvedValue([])
		await worker.scan(1)
		expect(execFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(Array),
			expect.objectContaining({ timeout: 30000, killSignal: "SIGKILL" }),
			expect.any(Function)
		)
	})
})

describe("startWorkers / stopWorkers", () => {
	const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

	beforeEach(() => {
		jest.useFakeTimers()
		execFile.mockClear()
		process.env.object_ON = "true"
		process.env.cameras = JSON.stringify(["a", "b"])
		detector.detect.mockResolvedValue([])
	})

	afterEach(() => {
		worker.stopWorkers()
		jest.useRealTimers()
		delete process.env.object_ON
	})

	test("runs one scan per camera and arms a re-arm timer for each", async () => {
		worker.startWorkers()
		await tick()
		expect(execFile).toHaveBeenCalledTimes(2)
		expect(jest.getTimerCount()).toBe(2)
		worker.stopWorkers()
		expect(jest.getTimerCount()).toBe(0)
	})

	test("does nothing when object_ON is not 'true'", () => {
		process.env.object_ON = "false"
		worker.startWorkers()
		expect(execFile).not.toHaveBeenCalled()
		expect(jest.getTimerCount()).toBe(0)
	})

	test("stopWorkers before scans resolve blocks the re-arm", async () => {
		worker.startWorkers()
		worker.stopWorkers()
		await tick()
		expect(execFile).toHaveBeenCalledTimes(2)
		expect(jest.getTimerCount()).toBe(0)
	})
})

describe("setConfig validation", () => {
	test("floors intervalMs at 1000ms", () => {
		worker.setConfig({ intervalMs: 0 })
		expect(worker.getConfig().intervalMs).toBe(1000)
		worker.setConfig({ intervalMs: 250 })
		expect(worker.getConfig().intervalMs).toBe(1000)
		worker.setConfig({ intervalMs: 4000 })
		expect(worker.getConfig().intervalMs).toBe(4000)
	})

	test("ignores non-finite intervalMs", () => {
		worker.setConfig({ intervalMs: 5000 })
		worker.setConfig({ intervalMs: "not-a-number" })
		expect(worker.getConfig().intervalMs).toBe(5000)
	})

	test("ignores out-of-range and non-finite confidence", () => {
		worker.setConfig({ confidence: 0.5 })
		worker.setConfig({ confidence: 2 })
		expect(worker.getConfig().confidence).toBe(0.5)
		worker.setConfig({ confidence: -1 })
		expect(worker.getConfig().confidence).toBe(0.5)
		worker.setConfig({ confidence: "" })
		expect(worker.getConfig().confidence).toBe(0.5)
	})

	test("accepts in-range confidence", () => {
		worker.setConfig({ confidence: 0.7 })
		expect(worker.getConfig().confidence).toBe(0.7)
	})

	test("accepts the inclusive confidence bounds 0 and 1", () => {
		worker.setConfig({ confidence: 0 })
		expect(worker.getConfig().confidence).toBe(0)
		worker.setConfig({ confidence: 1 })
		expect(worker.getConfig().confidence).toBe(1)
	})

	test("clamps intervalMs to the inclusive 1000ms floor and 24h ceiling", () => {
		worker.setConfig({ intervalMs: 1000 })
		expect(worker.getConfig().intervalMs).toBe(1000)
		worker.setConfig({ intervalMs: "999999999999" })
		expect(worker.getConfig().intervalMs).toBe(86400000)
	})
})

describe("CAPTURES_DIR", () => {
	const saved = process.env.storage_FOLDERPATH

	afterEach(() => {
		if (saved === undefined) delete process.env.storage_FOLDERPATH
		else process.env.storage_FOLDERPATH = saved
		jest.resetModules()
	})

	test("defaults to cwd/objectCaptures when storage_FOLDERPATH unset", () => {
		delete process.env.storage_FOLDERPATH
		jest.resetModules()
		const w = require("../backend/lib/worker.js")
		expect(w.CAPTURES_DIR).toBe(path.join(process.cwd(), "objectCaptures"))
	})

	test("uses storage_FOLDERPATH when set", () => {
		process.env.storage_FOLDERPATH = "/mnt/storage"
		jest.resetModules()
		const w = require("../backend/lib/worker.js")
		expect(w.CAPTURES_DIR).toBe(path.join("/mnt/storage", "objectCaptures"))
	})
})
