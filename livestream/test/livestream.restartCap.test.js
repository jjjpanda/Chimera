jest.mock("lib")
jest.mock("pm2")
jest.mock("memory")
jest.mock("axios")

describe("Livestream restart cap under cluster mode", () => {
	const originalEnv = process.env

	beforeEach(() => {
		jest.resetModules()
		process.env = { ...originalEnv, chimeraInstances: "4" }
	})

	afterAll(() => {
		process.env = originalEnv
	})

	test("keeps the 20/min cap regardless of the configured instance count", async () => {
		const supertest = require("supertest")
		const app = require("../backend/livestream.js")

		for(let i = 0; i < 20; i++){
			await supertest(app)
				.post("/livestream/restart")
				.set("Cookie", "validCookie")
				.set("X-Forwarded-For", "10.0.1.1")
				.send({ camera: 1 })
				.expect(200)
		}
		await supertest(app)
			.post("/livestream/restart")
			.set("Cookie", "validCookie")
			.set("X-Forwarded-For", "10.0.1.1")
			.send({ camera: 1 })
			.expect(429)
	})
})
