jest.mock("lib", () => ({ isPrimeInstance: true, objectState: { register: jest.fn() }, loadCameras: jest.fn(() => Promise.resolve([])), mapLimit: require("../../lib/utils/mapLimit.js"), webhookAlert: jest.fn() }))
jest.mock("child_process", () => ({ execFile: jest.fn() }))
jest.mock("fs", () => ({ mkdirSync: jest.fn(), readFileSync: jest.fn(), unlinkSync: jest.fn(), writeFileSync: jest.fn(), readdirSync: jest.fn(() => []), statSync: jest.fn(() => ({ mtimeMs: 0 })), promises: { readdir: jest.fn(() => Promise.resolve([])), stat: jest.fn(() => Promise.resolve({ mtimeMs: 0 })), unlink: jest.fn(() => Promise.resolve()), writeFile: jest.fn(() => Promise.resolve()) } }))
jest.mock("../backend/lib/pool.js", () => ({ query: jest.fn() }))
jest.mock("../backend/lib/webhook.js", () => jest.fn())
jest.mock("../backend/lib/detector.js", () => ({ INPUT: 4, detect: jest.fn() }))

const path = require("path")
const { execFile } = require("child_process")
const fs = require("fs")
const pool = require("../backend/lib/pool.js")
const sendWebhook = require("../backend/lib/webhook.js")
const detector = require("../backend/lib/detector.js")
const { loadCameras, webhookAlert } = require("lib")
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
	worker.stopWorkers()
	process.env.alert_URL = "http://hook.test"
	delete process.env.object_ALERT_ON
	execFile.mockImplementation((file, args, opts, cb) => cb(null))
	fs.readFileSync.mockImplementation((p) => String(p).endsWith(".raw") ? makeRaw() : Buffer.from("jpeg"))
	fs.promises.writeFile.mockResolvedValue()
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

describe("cameras", () => {
	test("returns id and name from loadCameras", async () => {
		loadCameras.mockResolvedValue([{ id: 7, name: "a", rtsp_url: "", full_url: "" }, { id: 3, name: "b", rtsp_url: "", full_url: "" }])
		expect(await worker.cameras()).toEqual([{ id: 7, name: "a" }, { id: 3, name: "b" }])
	})

	test("returns [] when loadCameras returns []", async () => {
		loadCameras.mockResolvedValue([])
		expect(await worker.cameras()).toEqual([])
	})

	test("propagates a loadCameras failure instead of masking it as []", async () => {
		loadCameras.mockRejectedValueOnce(new Error("conf dir unreadable"))
		await expect(worker.cameras()).rejects.toThrow("conf dir unreadable")
	})

	test("reload bypasses the TTL cache that a plain call would hit", async () => {
		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		expect(await worker.cameras()).toEqual([{ id: 1, name: "a" }])
		loadCameras.mockResolvedValue([{ id: 2, name: "b" }])
		expect(await worker.cameras()).toEqual([{ id: 1, name: "a" }])
		expect(await worker.cameras(true)).toEqual([{ id: 2, name: "b" }])
	})
})

describe("scan", () => {
	beforeEach(() => {
		loadCameras.mockResolvedValue([
			{ id: 1, name: "a" }, { id: 2, name: "b" }, { id: 3, name: "c" }, { id: 4, name: "d" }, { id: 5, name: "e" }
		])
	})

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
		expect(pool.query).toHaveBeenCalledTimes(1)
		expect(pool.query).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO objects_detected"),
			[
				2, "person", 0.876543, "[0,0,1,1]", expect.stringMatching(/^2-\d+\.jpg$/),
				2, "car", 0.99, "[0,0,1,1]", expect.stringMatching(/^2-\d+\.jpg$/)
			]
		)
		expect(sendWebhook).toHaveBeenCalledWith(
			"http://hook.test",
			expect.stringContaining("person (88%)"),
			expect.any(Buffer)
		)
		expect(worker.getStatus()[2].error).toBeNull()
		expect(worker.getStatus()[2].lastDetection.detections).toHaveLength(2)
	})

	test("skips a malformed detection without dropping the valid rows", async () => {
		detector.detect.mockResolvedValue([
			{ class: "person", score: 0.9, box: [0, 0, 1, 1] },
			{ class: "car", score: 0.8, box: undefined }
		])
		await worker.scan(2)
		expect(pool.query).toHaveBeenCalledTimes(1)
		expect(pool.query).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO objects_detected"),
			[2, "person", 0.9, "[0,0,1,1]", expect.stringMatching(/^2-\d+\.jpg$/)]
		)
	})

	test("single detection inserts + webhooks", async () => {
		detector.detect.mockResolvedValue([{ class: "car", score: 0.9, box: [0, 0, 1, 1] }])
		const detections = await worker.scan(3)
		expect(detections).toHaveLength(1)
		expect(pool.query).toHaveBeenCalledTimes(1)
		expect(sendWebhook).toHaveBeenCalledTimes(1)
		expect(worker.getStatus()[3].error).toBeNull()
	})

	test("still alerts when the capture write fails, but persists nothing and raises an admin alert", async () => {
		fs.promises.writeFile.mockRejectedValueOnce(new Error("ENOSPC"))
		detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])
		await worker.scan(4)
		expect(pool.query).not.toHaveBeenCalled()
		expect(sendWebhook).toHaveBeenCalledWith(
			"http://hook.test",
			expect.stringContaining("person (90%)"),
			expect.any(Buffer)
		)
		expect(webhookAlert).toHaveBeenCalledWith(expect.stringContaining("ENOSPC"), "admin")
	})

	test("only raises one admin alert until a capture write succeeds again", async () => {
		fs.promises.writeFile.mockRejectedValue(new Error("ENOSPC"))
		detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])
		await worker.scan(4)
		await worker.scan(4)
		expect(webhookAlert).toHaveBeenCalledTimes(1)
		fs.promises.writeFile.mockResolvedValue()
		await worker.scan(4)
		fs.promises.writeFile.mockRejectedValue(new Error("ENOSPC"))
		await worker.scan(4)
		expect(webhookAlert).toHaveBeenCalledTimes(2)
	})

	test("object_ALERT_ON=false suppresses the webhook but still inserts", async () => {
		process.env.object_ALERT_ON = "false"
		detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])
		await worker.scan(5)
		expect(pool.query).toHaveBeenCalledTimes(1)
		expect(sendWebhook).not.toHaveBeenCalled()
		delete process.env.object_ALERT_ON
	})

	test("records ffmpeg failure in a tracked camera's status and rejects", async () => {
		detector.detect.mockResolvedValue([])
		await worker.scan(4)
		detector.detect.mockClear()
		execFile.mockImplementation((file, args, opts, cb) => cb(new Error("ffmpeg boom")))
		await expect(worker.scan(4)).rejects.toThrow("ffmpeg boom")
		expect(detector.detect).not.toHaveBeenCalled()
		expect(worker.getStatus()[4].error).toBe("scan failed")
	})

	test("a scan still in flight when the workers stop persists nothing", async () => {
		let release
		execFile.mockImplementation((file, args, opts, cb) => { release = cb })
		detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])

		const scanning = worker.scan(1)
		for (let i = 0; i < 10; i++) await Promise.resolve()
		worker.stopWorkers()
		release(null)
		await scanning

		expect(fs.promises.writeFile).not.toHaveBeenCalled()
		expect(pool.query).not.toHaveBeenCalled()
		expect(sendWebhook).not.toHaveBeenCalled()
	})

	test("a scan whose camera is stopped during the capture write inserts nothing, sends no webhook, and unlinks the orphaned capture", async () => {
		let release
		fs.promises.writeFile.mockImplementation(() => new Promise((r) => { release = r }))
		detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])

		const scanning = worker.scan(1)
		for (let i = 0; i < 10; i++) await Promise.resolve()
		expect(release).toEqual(expect.any(Function))
		worker.stopWorkers()
		release()
		await scanning

		expect(fs.promises.writeFile).toHaveBeenCalledTimes(1)
		expect(pool.query).not.toHaveBeenCalled()
		expect(sendWebhook).not.toHaveBeenCalled()
		const written = path.basename(fs.promises.writeFile.mock.calls[0][0])
		expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(worker.CAPTURES_DIR, written))
	})

	test("scanning an unknown camera id throws distinguishably and leaves no status entry behind", async () => {
		const err = await worker.scan(999).catch((e) => e)
		expect(err).toBeInstanceOf(Error)
		expect(err.message).toBe("unknown camera")
		expect(err.code).toBe("UNKNOWN_CAMERA")
		expect(worker.getStatus()[999]).toBeUndefined()
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
	const tick = async () => { for (let i = 0; i < 25; i++) await Promise.resolve() }

	const feedOf = (args) => String(args[args.indexOf("-i") + 1]).replace(/\\/g, "/")
	const scansOf = (feed) => execFile.mock.calls.filter((c) => feedOf(c[1]).endsWith(`feed/${feed}/video.m3u8`)).length
	const hangFeed = (feed) => {
		let held = null
		execFile.mockImplementation((file, args, opts, cb) => {
			if (feedOf(args).endsWith(`feed/${feed}/video.m3u8`) && !held) held = cb
			else cb(null)
		})
	}

	beforeEach(() => {
		jest.useFakeTimers()
		execFile.mockClear()
		process.env.object_ON = "true"
		loadCameras.mockResolvedValue([{ id: 1, name: "a" }, { id: 2, name: "b" }])
		detector.detect.mockResolvedValue([])
	})

	afterEach(() => {
		worker.stopWorkers()
		jest.useRealTimers()
		delete process.env.object_ON
	})

	test("runs one scan per camera and arms a re-arm timer for each plus prune and reconcile timers", async () => {
		await worker.startWorkers()
		await tick()
		expect(execFile).toHaveBeenCalledTimes(2)
		expect(jest.getTimerCount()).toBe(4)
		worker.stopWorkers()
		expect(jest.getTimerCount()).toBe(0)
	})

	test("prunes captures on an interval, not per detection", async () => {
		fs.promises.readdir.mockClear()
		await worker.startWorkers()
		await tick()
		expect(fs.promises.readdir).not.toHaveBeenCalled()
		jest.advanceTimersByTime(300000)
		expect(fs.promises.readdir).toHaveBeenCalled()
		worker.stopWorkers()
	})

	test("does nothing when object_ON is not 'true'", async () => {
		process.env.object_ON = "false"
		await worker.startWorkers()
		expect(execFile).not.toHaveBeenCalled()
		expect(jest.getTimerCount()).toBe(0)
	})

	test("stopWorkers before scans resolve blocks the re-arm", async () => {
		await worker.startWorkers()
		worker.stopWorkers()
		await tick()
		expect(execFile).toHaveBeenCalledTimes(2)
		expect(jest.getTimerCount()).toBe(0)
	})

	test("stopWorkers during the async camera load prevents workers from starting", async () => {
		let release
		loadCameras.mockReturnValueOnce(new Promise(r => { release = r }))
		const started = worker.startWorkers()
		worker.stopWorkers()
		release([{ id: 1, name: "a" }, { id: 2, name: "b" }])
		await started
		await tick()
		expect(execFile).not.toHaveBeenCalled()
		expect(jest.getTimerCount()).toBe(0)
	})

	test("stopWorkers flips every camera's running flag to false", async () => {
		await worker.startWorkers()
		await tick()
		expect(worker.getStatus()[1].running).toBe(true)
		expect(worker.getStatus()[2].running).toBe(true)
		worker.stopWorkers()
		expect(worker.getStatus()[1].running).toBe(false)
		expect(worker.getStatus()[2].running).toBe(false)
	})

	test("a start interleaved with stop/start does not leak timers from the stale era", async () => {
		let release
		loadCameras.mockReturnValueOnce(new Promise(r => { release = r }))
		const stale = worker.startWorkers()
		worker.stopWorkers()
		const fresh = worker.startWorkers()
		release([{ id: 1, name: "a" }, { id: 2, name: "b" }])
		await Promise.all([stale, fresh])
		await tick()
		expect(execFile).toHaveBeenCalledTimes(2)
		expect(jest.getTimerCount()).toBe(4)
	})

	test("a camera deleted while running is evicted instead of looping forever", async () => {
		await worker.startWorkers()
		await tick()
		expect(jest.getTimerCount()).toBe(4)

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		jest.advanceTimersByTime(30000)
		await tick()

		expect(worker.getStatus()[2]).toBeUndefined()
		expect(jest.getTimerCount()).toBe(3)
	})

	test("a camera that reappears after eviction gets a worker back", async () => {
		await worker.startWorkers()
		await tick()

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		jest.advanceTimersByTime(30000)
		await tick()
		expect(worker.getStatus()[2]).toBeUndefined()

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }, { id: 2, name: "b" }])
		jest.advanceTimersByTime(30000)
		await tick()

		expect(worker.getStatus()[2].running).toBe(true)
		expect(jest.getTimerCount()).toBe(4)
	})

	test("a scan still in flight across an evict and re-add does not leave a second loop behind", async () => {
		let hung = null
		execFile.mockImplementation((file, args, opts, cb) => {
			const feed = String(args[args.indexOf("-i") + 1]).replace(/\\/g, "/")
			if (feed.endsWith("feed/2/video.m3u8") && !hung) hung = cb
			else cb(null)
		})
		await worker.startWorkers()
		await tick()
		expect(hung).toEqual(expect.any(Function))

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		jest.advanceTimersByTime(30000)
		await tick()
		expect(worker.getStatus()[2]).toBeUndefined()

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }, { id: 2, name: "b" }])
		jest.advanceTimersByTime(30000)
		await tick()
		expect(jest.getTimerCount()).toBe(4)

		hung(null)
		await tick()
		expect(jest.getTimerCount()).toBe(4)
		worker.stopWorkers()
		expect(jest.getTimerCount()).toBe(0)
	})

	test("a hung scan is capped and not relaunched, and does not stall the other cameras", async () => {
		hangFeed(2)
		await worker.startWorkers()
		await tick()
		expect(scansOf(1)).toBe(1)
		expect(scansOf(2)).toBe(1)

		for (let i = 0; i < 6; i++) {
			jest.advanceTimersByTime(worker.getConfig().intervalMs)
			await tick()
		}

		expect(scansOf(1)).toBe(7)
		expect(scansOf(2)).toBe(1)
		expect(worker.getStatus()[2].error).toBe("capture failed")
		expect(worker.getStatus()[1].error).toBeNull()
		expect(jest.getTimerCount()).toBe(4)
	})

	test("a permanently hung scan does not wedge its camera across a restart", async () => {
		hangFeed(2)
		await worker.startWorkers()
		await tick()
		for (let i = 0; i < 6; i++) {
			jest.advanceTimersByTime(worker.getConfig().intervalMs)
			await tick()
		}
		expect(scansOf(2)).toBe(1)

		await worker.startWorkers()
		await tick()

		expect(scansOf(2)).toBe(2)
		expect(worker.getStatus()[2].error).toBeNull()
	})

	test("a camera deleted from disk persists nothing on its next scan, even while the camera cache still lists it", async () => {
		detector.detect.mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }])
		await worker.startWorkers()
		await tick()

		fs.promises.writeFile.mockClear()
		pool.query.mockClear()
		sendWebhook.mockClear()

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		jest.advanceTimersByTime(worker.getConfig().intervalMs)
		await tick()

		const written = fs.promises.writeFile.mock.calls.map((c) => path.basename(String(c[0])))
		expect(written).toEqual([expect.stringMatching(/^1-\d+\.jpg$/)])
		expect(pool.query).toHaveBeenCalledTimes(1)
		expect(pool.query.mock.calls[0][1][0]).toBe(1)
		expect(sendWebhook).toHaveBeenCalledTimes(1)
		expect(sendWebhook.mock.calls[0][1]).toContain("Camera 1")
	})

	test("a camera added while running gets a worker without a restart", async () => {
		await worker.startWorkers()
		await tick()
		expect(jest.getTimerCount()).toBe(4)

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }, { id: 2, name: "b" }, { id: 3, name: "c" }])
		jest.advanceTimersByTime(30000)
		await tick()

		expect(worker.getStatus()[3].running).toBe(true)
		expect(jest.getTimerCount()).toBe(5)
	})

	test("removing the last camera evicts its worker instead of scanning it forever", async () => {
		await worker.startWorkers()
		await tick()

		loadCameras.mockResolvedValue([])
		jest.advanceTimersByTime(30000)
		await tick()

		expect(worker.getStatus()).toEqual({})
		expect(jest.getTimerCount()).toBe(2)

		execFile.mockClear()
		jest.advanceTimersByTime(worker.getConfig().intervalMs)
		await tick()
		expect(execFile).not.toHaveBeenCalled()
	})

	test("a camera added after every camera was removed gets a worker back", async () => {
		await worker.startWorkers()
		await tick()

		loadCameras.mockResolvedValue([])
		jest.advanceTimersByTime(30000)
		await tick()
		expect(worker.getStatus()).toEqual({})

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		jest.advanceTimersByTime(30000)
		await tick()

		expect(worker.getStatus()[1].running).toBe(true)
		expect(jest.getTimerCount()).toBe(3)
	})

	test("a failed camera load evicts nobody and recovers on the next reconcile", async () => {
		await worker.startWorkers()
		await tick()

		loadCameras.mockRejectedValueOnce(new Error("conf dir unreadable"))
		jest.advanceTimersByTime(30000)
		await tick()

		expect(worker.getStatus()[1].running).toBe(true)
		expect(worker.getStatus()[2].running).toBe(true)
		expect(jest.getTimerCount()).toBe(4)

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		jest.advanceTimersByTime(30000)
		await tick()
		expect(worker.getStatus()[2]).toBeUndefined()
	})

	test("reconcile reloads on every tick even when a slow load stamps the cache mid-interval", async () => {
		loadCameras.mockResolvedValue([])
		await worker.startWorkers()
		await tick()

		let release
		loadCameras.mockReturnValueOnce(new Promise(r => { release = r }))
		jest.advanceTimersByTime(30000)
		jest.advanceTimersByTime(1)
		release([])
		await tick()

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		jest.advanceTimersByTime(29999)
		await tick()

		expect(worker.getStatus()[1].running).toBe(true)
	})

	test("a deleted camera stops being reported by getStatus", async () => {
		await worker.startWorkers()
		await tick()
		expect(Object.keys(worker.getStatus())).toEqual(["1", "2"])

		loadCameras.mockResolvedValue([{ id: 1, name: "a" }])
		jest.advanceTimersByTime(30000)
		await tick()

		expect(Object.keys(worker.getStatus())).toEqual(["1"])
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

describe("env-derived numeric config", () => {
	const savedConf = process.env.object_CONFIDENCE
	const savedMax = process.env.object_MAX_CAPTURES

	afterEach(() => {
		if (savedConf === undefined) delete process.env.object_CONFIDENCE
		else process.env.object_CONFIDENCE = savedConf
		if (savedMax === undefined) delete process.env.object_MAX_CAPTURES
		else process.env.object_MAX_CAPTURES = savedMax
		jest.resetModules()
	})

	test("object_CONFIDENCE=0 is honored, not coerced to default", () => {
		process.env.object_CONFIDENCE = "0"
		jest.resetModules()
		expect(require("../backend/lib/worker.js").getConfig().confidence).toBe(0)
	})

	test("confidence defaults to 0.5 when unset or non-numeric", () => {
		delete process.env.object_CONFIDENCE
		jest.resetModules()
		expect(require("../backend/lib/worker.js").getConfig().confidence).toBe(0.5)
	})

	test("object_MAX_CAPTURES=0 is honored, not coerced to default", () => {
		process.env.object_MAX_CAPTURES = "0"
		jest.resetModules()
		expect(require("../backend/lib/worker.js").MAX_CAPTURES).toBe(0)
	})

	test("MAX_CAPTURES defaults to 500 when unset or non-numeric", () => {
		delete process.env.object_MAX_CAPTURES
		jest.resetModules()
		expect(require("../backend/lib/worker.js").MAX_CAPTURES).toBe(500)
	})

	test("object_MAX_CAPTURES=-1 clamps to 0 instead of going negative", () => {
		process.env.object_MAX_CAPTURES = "-1"
		jest.resetModules()
		expect(require("../backend/lib/worker.js").MAX_CAPTURES).toBe(0)
	})

	test("pruneCaptures with MAX_CAPTURES=0 skips pruning instead of wiping every capture", async () => {
		process.env.object_MAX_CAPTURES = "0"
		jest.resetModules()
		const freshFs = require("fs")
		const freshPool = require("../backend/lib/pool.js")
		const freshWorker = require("../backend/lib/worker.js")
		freshFs.promises.readdir.mockResolvedValue(["a.jpg", "b.jpg"])

		await freshWorker.pruneCaptures()

		expect(freshFs.promises.readdir).not.toHaveBeenCalledWith(freshWorker.CAPTURES_DIR)
		expect(freshFs.promises.unlink).not.toHaveBeenCalled()
		expect(freshPool.query).not.toHaveBeenCalled()
	})

	test("object_CONFIDENCE > 1 falls back to the default instead of disabling detection", () => {
		process.env.object_CONFIDENCE = "2"
		jest.resetModules()
		expect(require("../backend/lib/worker.js").getConfig().confidence).toBe(0.5)
	})

	test("object_CONFIDENCE < 0 falls back to the default", () => {
		process.env.object_CONFIDENCE = "-1"
		jest.resetModules()
		expect(require("../backend/lib/worker.js").getConfig().confidence).toBe(0.5)
	})
})
