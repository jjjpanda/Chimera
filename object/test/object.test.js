const supertest = require("supertest")

jest.mock("lib")
jest.mock("axios")
jest.mock("pg", () => ({
	Pool: jest.fn().mockImplementation(() => ({
		on: jest.fn(),
		query: jest.fn().mockResolvedValue({
			rows: [{ id: 1, camera: 1, timestamp: "t", type: "person", confidence: 0.9 }]
		})
	}))
}))
jest.mock("../backend/lib/worker.js", () => ({
	startWorkers: jest.fn(),
	scan: jest.fn().mockResolvedValue([{ class: "person", score: 0.9, box: [0, 0, 1, 1] }]),
	getStatus: () => ({ 1: { running: true, lastRun: null, lastDetection: null, error: null } }),
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
