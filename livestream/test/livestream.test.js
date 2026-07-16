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

		test("rejects a status camera that is not a plain number", async () => {
			for(const camera of ["abc", "1 all", "../1", "1e3", "1".repeat(11)]){
				await supertest(app)
					.get(`/livestream/status?camera=${encodeURIComponent(camera)}`)
					.set("Cookie", cookieWithMockedBearerToken)
					.expect(400)
			}
		})
	})

	describe("POST /restart", () => {
		test("unauthenticated user is unauthorized", (done) => {
			supertest(app)
				.post("/livestream/restart")
				.send({ camera: 1 })
				.expect(401, done)
		})

		test("non-admin user passes the gate (400 without a camera)", (done) => {
			supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "userCookie")
				.send({})
				.expect(400, done)
		})

		test("admin passes the gate (400 without a camera)", (done) => {
			supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "validCookie")
				.send({})
				.expect(400, done)
		})

		test("restarts a numeric camera", (done) => {
			supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "userCookie")
				.set("X-Forwarded-For", "10.0.0.1")
				.send({ camera: 1 })
				.expect(200, done)
		})

		test("reports a failed restart instead of a phantom success", (done) => {
			supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "validCookie")
				.set("X-Forwarded-For", "10.0.0.5")
				.send({ camera: 9999999999 })
				.expect(500, done)
		})

		test("rejects a camera that is not a plain number", async () => {
			for(const camera of ["abc", "1 all", "../1", "1e3", "1".repeat(11)]){
				await supertest(app)
					.post("/livestream/restart")
					.set("Cookie", "validCookie")
					.set("X-Forwarded-For", "10.0.0.2")
					.send({ camera })
					.expect(400)
			}
		})

		test("rate limits restarts per ip", async () => {
			for(let i = 0; i < 20; i++){
				await supertest(app)
					.post("/livestream/restart")
					.set("Cookie", "validCookie")
					.set("X-Forwarded-For", "10.0.0.3")
					.send({ camera: 1 })
					.expect(200)
			}
			await supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "validCookie")
				.set("X-Forwarded-For", "10.0.0.3")
				.send({ camera: 1 })
				.expect(429)
			await supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "validCookie")
				.set("X-Forwarded-For", "10.0.0.4")
				.send({ camera: 1 })
				.expect(200)
		})

		test("one camera's exhausted budget does not block the other cameras", async () => {
			for(let i = 0; i < 20; i++){
				await supertest(app)
					.post("/livestream/restart")
					.set("Cookie", "validCookie")
					.set("X-Forwarded-For", "10.0.0.6")
					.send({ camera: 1 })
					.expect(200)
			}
			await supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "validCookie")
				.set("X-Forwarded-For", "10.0.0.6")
				.send({ camera: 1 })
				.expect(429)
			for(const camera of [2, 3]){
				await supertest(app)
					.post("/livestream/restart")
					.set("Cookie", "validCookie")
					.set("X-Forwarded-For", "10.0.0.6")
					.send({ camera })
					.expect(200)
			}
		})

		test("an invalid camera is rejected before it can consume a budget", async () => {
			for(let i = 0; i < 25; i++){
				await supertest(app)
					.post("/livestream/restart")
					.set("Cookie", "validCookie")
					.set("X-Forwarded-For", "10.0.0.7")
					.send({ camera: "abc" })
					.expect(400)
			}
			await supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "validCookie")
				.set("X-Forwarded-For", "10.0.0.7")
				.send({ camera: 1 })
				.expect(200)
		})
	})
})