const supertest = require("supertest")
const app = require("../backend/storage.js")

jest.mock("pm2")
jest.mock("memory")

describe("Heartbeat Health Route", () => {
	test("/storage/health responds with 200", (done) => {
		supertest(app)
			.get("/storage/health")
			.expect(200, done)
	})
})