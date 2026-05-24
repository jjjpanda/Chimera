const supertest = require("supertest")
const app = require("../backend/storage.js")

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")
jest.mock("axios")

describe("File Routes", () => {
	let cookieWithBearerToken = "validCookie"

	describe("/file/pathStats", () => {
		test("bruh", () => expect(2+2).toBe(4))
	})

	describe("/file/pathSize", () => {
		test("bruh", () => expect(2+2).toBe(4))
	})

	describe("/file/pathFileCount", () => {
		test("bruh", () => expect(2+2).toBe(4))
	})

	describe("/file/pathMetrics", () => {
		test("bruh", () => expect(2+2).toBe(4))
	})

	describe("/file/pathDelete", () => {
		test("returns 401 with no cookie", (done) => {
			supertest(app)
				.post("/file/pathDelete")
				.send({})
				.expect(401, done)
		})

		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/file/pathDelete")
				.send({})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})
	})

	describe("/file/pathClean", () => {
		test("returns 401 with no cookie", (done) => {
			supertest(app)
				.post("/file/pathClean")
				.send({})
				.expect(401, done)
		})

		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/file/pathClean")
				.send({})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})
	})
})