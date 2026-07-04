const supertest = require("supertest")

const mockQuery = jest.fn().mockResolvedValue({
	rows: [{ id: 1, camera: 1, timestamp: "t", type: "person", confidence: 0.9 }]
})

jest.mock("lib")
jest.mock("axios")
jest.mock("pg", () => ({
	Pool: jest.fn().mockImplementation(() => ({ on: jest.fn(), query: mockQuery }))
}))
jest.mock("../backend/lib/worker.js", () => ({
	startWorkers: jest.fn(),
	CAPTURES_DIR: ".",
	scan: jest.fn().mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }]),
	getStatus: () => ({ 1: { running: true, lastRun: null, lastDetection: null, error: null } }),
	cameras: () => [{ id: 1, name: "Camera 1" }],
	getConfig: () => ({ confidence: 0.5, intervalMs: 5000, classes: ["person"] }),
	setConfig: (updates) => ({ confidence: 0.5, intervalMs: 5000, classes: ["person"], ...updates })
}))

const app = require("../backend/object.js")

const authorized = "validCookie"

describe("Object Routes", () => {
	test("Unauthorized status", (done) => {
		supertest(app).get("/object/status").expect(303, done)
	})

	test("Authorized status reads the local worker", (done) => {
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

	test("Config read from the local worker", (done) => {
		supertest(app)
			.get("/object/config")
			.set("Cookie", authorized)
			.expect(200)
			.expect((res) => expect(res.body.confidence).toBe(0.5))
			.end(done)
	})

	test("Detections", (done) => {
		supertest(app)
			.get("/object/detections")
			.set("Cookie", authorized)
			.expect(200, [{ id: 1, camera: 1, timestamp: "t", type: "person", confidence: 0.9 }], done)
	})

	test("Detections filter by the camera_id directly", (done) => {
		supertest(app)
			.get("/object/detections?camera=7")
			.set("Cookie", authorized)
			.expect(200)
			.expect(() => expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [7, 50]))
			.end(done)
	})

	test("Detections reject a non-numeric camera", (done) => {
		supertest(app)
			.get("/object/detections?camera=abc")
			.set("Cookie", authorized)
			.expect(400, done)
	})

	test("Config update requires auth", (done) => {
		supertest(app).post("/object/config").send({ confidence: 0.7 }).expect(401, done)
	})

	test("Config update writes the local worker", (done) => {
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

	test("Scan runs the local worker", (done) => {
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

	test("Scan returns 502 when the local worker scan fails", (done) => {
		require("../backend/lib/worker.js").scan.mockRejectedValueOnce(new Error("frame grab failed"))
		supertest(app)
			.post("/object/scan")
			.set("Cookie", authorized)
			.send({ camera: 1 })
			.expect(502)
			.expect((res) => expect(res.body.error).toBe("frame grab failed"))
			.end(done)
	})
})

describe("Object Routes (non-prime instance)", () => {
	test("returns 503 when not the prime instance", (done) => {
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
