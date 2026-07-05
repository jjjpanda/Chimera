const supertest = require("supertest")
const app = require("../backend/livestream.js")

const processList = [1, 2, 3].map((i) => ({
	name: `live_stream_cam_${i}`,
	status: "on",
	restarts: 0
}))

jest.mock("pm2")
jest.mock("memory")
jest.mock("lib")
jest.mock("axios")

describe("Livestream Routes", () => {
	test("Unauthorized livestream status", (done) => {
		supertest(app)
			.get("/livestream/status")
			.expect(303, done)
	})

	describe("Authorized Livestream Status", () => {
		let cookieWithMockedBearerToken = "validCookie"

		test("Livestream status", (done) => {
			supertest(app)
				.get("/livestream/status")
				.set("Cookie", cookieWithMockedBearerToken)
				.expect(200, processList, done)
		})
    
		test("Livestream status of specific camera", (done) => {
			supertest(app)
				.get("/livestream/status?camera=1")
				.set("Cookie", cookieWithMockedBearerToken)
				.expect(200, [ processList[0] ], done)
		})
    
		test("Livestream status of specific camera that doesn't exist", (done) => {
			supertest(app)
				.get("/livestream/status?camera=9999")
				.set("Cookie", cookieWithMockedBearerToken)
				.expect(204, {}, done)
		})
	})

	describe("POST /restart admin gating", () => {
		test("non-admin user is forbidden", (done) => {
			supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "userCookie")
				.send({ camera: 1 })
				.expect(403, done)
		})

		test("admin passes the gate (400 without a camera)", (done) => {
			supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "validCookie")
				.send({})
				.expect(400, done)
		})
	})
})