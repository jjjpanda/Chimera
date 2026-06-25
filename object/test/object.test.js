const supertest = require("supertest")

process.env.memory_ON = "true"

let mockConnected = false
let mockEmitError = false
const mockEmit = jest.fn((event, arg, cb2) => {
	const cb = typeof cb2 === "function" ? cb2 : arg
	if (mockEmitError) return cb(new Error("ack timeout"))
	if (event === "objectGetState") cb(null, { config: { confidence: 0.42, intervalMs: 5000, classes: [] }, status: { 9: { running: true } } })
	else if (event === "objectSetConfig") cb(null, { confidence: 0.8, intervalMs: 5000, classes: [] })
	else if (event === "objectScan") cb(null, [{ class: "car", score: 0.77, box: [0, 0, 1, 1] }])
})

const mockQuery = jest.fn().mockResolvedValue({
	rows: [{ id: 1, camera: 1, timestamp: "t", type: "person", confidence: 0.9 }]
})

jest.mock("lib")
jest.mock("axios")
jest.mock("memory", () => ({ client: () => ({ get connected() { return mockConnected }, timeout() { return this }, emit: mockEmit, on: () => {} }) }))
jest.mock("pg", () => ({
	Pool: jest.fn().mockImplementation(() => ({ on: jest.fn(), query: mockQuery }))
}))
jest.mock("../backend/lib/worker.js", () => ({
	startWorkers: jest.fn(),
	CAPTURES_DIR: ".",
	scan: jest.fn().mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }]),
	getStatus: () => ({ 1: { running: true, lastRun: null, lastDetection: null, error: null } }),
	getCameraNames: () => ["Camera 1"],
	getConfig: () => ({ confidence: 0.5, intervalMs: 5000, classes: ["person"] }),
	setConfig: (updates) => ({ confidence: 0.5, intervalMs: 5000, classes: ["person"], ...updates })
}))

const app = require("../backend/object.js")

const authorized = "validCookie"

describe("Object Routes", () => {
	test("Unauthorized status", (done) => {
		supertest(app).get("/object/status").expect(303, done)
	})

	test("Authorized status", (done) => {
		supertest(app)
			.get("/object/status")
			.set("Cookie", authorized)
			.expect(200)
			.expect((res) => {
				expect(res.body.config.confidence).toBe(0.5)
				expect(res.body.cameras["1"].running).toBe(true)
			})
			.end(done)
	})

	test("Detections", (done) => {
		supertest(app)
			.get("/object/detections")
			.set("Cookie", authorized)
			.expect(200, [{ id: 1, camera: 1, timestamp: "t", type: "person", confidence: 0.9 }], done)
	})

	test("Detections translate a camera_id to the worker's env-order index", (done) => {
		const worker = require("../backend/lib/worker.js")
		const origNames = worker.getCameraNames
		require("lib").loadCameras.mockReturnValueOnce([{ id: 7, name: "outdoor" }, { id: 3, name: "indoor" }])
		worker.getCameraNames = () => ["indoor", "outdoor"]
		supertest(app)
			.get("/object/detections?camera=7")
			.set("Cookie", authorized)
			.expect(200)
			.expect(() => expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [2, 50]))
			.end((err) => { worker.getCameraNames = origNames; done(err) })
	})

	test("Detections reject an unknown camera id instead of querying the raw id", (done) => {
		require("lib").loadCameras.mockReturnValueOnce([{ id: 7, name: "outdoor" }])
		supertest(app)
			.get("/object/detections?camera=999")
			.set("Cookie", authorized)
			.expect(400, done)
	})

	test("Config update requires auth", (done) => {
		supertest(app).post("/object/config").send({ confidence: 0.7 }).expect(401, done)
	})

	test("Config update", (done) => {
		supertest(app)
			.post("/object/config")
			.set("Cookie", authorized)
			.send({ confidence: 0.7 })
			.expect(200)
			.expect((res) => expect(res.body.confidence).toBe(0.7))
			.end(done)
	})

	test("Scan requires camera", (done) => {
		supertest(app).post("/object/scan").set("Cookie", authorized).send({}).expect(400, done)
	})

	test("Scan", (done) => {
		supertest(app)
			.post("/object/scan")
			.set("Cookie", authorized)
			.send({ camera: 1 })
			.expect(200)
			.expect((res) => {
				expect(res.body.camera).toBe(1)
				expect(res.body.detections[0].class).toBe("person")
			})
			.end(done)
	})
})

describe("Object Routes (shared state via a connected memory client)", () => {
	beforeAll(() => { mockConnected = true })
	afterAll(() => { mockConnected = false })
	afterEach(() => { mockEmitError = false })

	test("status reads state from the memory client", (done) => {
		supertest(app)
			.get("/object/status")
			.set("Cookie", authorized)
			.expect(200)
			.expect((res) => {
				expect(res.body.config.confidence).toBe(0.42)
				expect(res.body.cameras["9"].running).toBe(true)
				expect(mockEmit).toHaveBeenCalledWith("objectGetState", expect.any(Function))
			})
			.end(done)
	})

	test("config update writes through the memory client", (done) => {
		supertest(app)
			.post("/object/config")
			.set("Cookie", authorized)
			.send({ confidence: 0.8 })
			.expect(200)
			.expect((res) => {
				expect(res.body.confidence).toBe(0.8)
				expect(mockEmit).toHaveBeenCalledWith("objectSetConfig", { confidence: 0.8 }, expect.any(Function))
			})
			.end(done)
	})

	test("config read comes from the memory client", (done) => {
		supertest(app)
			.get("/object/config")
			.set("Cookie", authorized)
			.expect(200)
			.expect((res) => {
				expect(res.body.confidence).toBe(0.42)
				expect(mockEmit).toHaveBeenCalledWith("objectGetState", expect.any(Function))
			})
			.end(done)
	})

	test("scan routes through the memory client", (done) => {
		supertest(app)
			.post("/object/scan")
			.set("Cookie", authorized)
			.send({ camera: 3 })
			.expect(200)
			.expect((res) => {
				expect(res.body.camera).toBe(3)
				expect(res.body.detections[0].class).toBe("car")
				expect(mockEmit).toHaveBeenCalledWith("objectScan", 3, expect.any(Function))
			})
			.end(done)
	})

	test("falls back to the local worker when the memory ack errors", (done) => {
		mockEmitError = true
		supertest(app)
			.get("/object/status")
			.set("Cookie", authorized)
			.expect(200)
			.expect((res) => {
				expect(res.body.config.confidence).toBe(0.5)
				expect(res.body.cameras["1"].running).toBe(true)
			})
			.end(done)
	})
})

describe("Object Routes (non-prime instance)", () => {
	test("returns 503 when shared state is unavailable", (done) => {
		const lib = require("lib")
		const wasPrime = lib.isPrimeInstance
		lib.isPrimeInstance = false
		let freshApp
		jest.isolateModules(() => { freshApp = require("../backend/object.js") })
		lib.isPrimeInstance = wasPrime
		supertest(freshApp)
			.get("/object/status")
			.set("Cookie", authorized)
			.expect(503)
			.expect((res) => expect(res.body.error).toBe("state unavailable"))
			.end(done)
	})
})
