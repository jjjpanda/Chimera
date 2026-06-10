process.env.storage_FOLDERPATH = "/tmp/storage-file-test"

const supertest = require("supertest")

jest.mock("lib")
jest.mock("fs")
jest.mock("child_process")
jest.mock("memory")
jest.mock("pm2")
jest.mock("axios")
jest.mock("pg", () => {
	const query = jest.fn((sql) =>
		Promise.resolve(/COUNT/.test(sql) ? { rows: [{ count: "0" }] } : { rows: [] })
	)
	return { Pool: jest.fn(() => ({ query, on: jest.fn() })), __query: query }
})

const app = require("../backend/storage.js")
const fs = require("fs")
const { execFile } = require("child_process")
const { __query: query } = require("pg")

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

	describe("/file/pathAutoClean", () => {
		test("returns 401 with no cookie", (done) => {
			supertest(app)
				.post("/file/pathAutoClean")
				.send({})
				.expect(401, done)
		})

		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/file/pathAutoClean")
				.send({})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})

		describe("as admin", () => {
			let unlinkSpy
			beforeEach(() => {
				unlinkSpy = jest.spyOn(fs.promises, "unlink").mockResolvedValue(undefined)
			})
			afterEach(() => {
				unlinkSpy.mockRestore()
				execFile.mockReset()
				delete process.env.storage_MAX_GB
			})

			test("skips when storage_MAX_GB is unset", async () => {
				delete process.env.storage_MAX_GB
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ skipped: true })
				expect(execFile).not.toHaveBeenCalled()
			})

			test("reports cleaned:false when usage is under target", async () => {
				process.env.storage_MAX_GB = "10"
				execFile.mockImplementation((_cmd, _args, cb) => cb(null, "1000000\t/path\n"))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: false })
				expect(query).not.toHaveBeenCalled()
			})

			test("deletes oldest frames until under target when over limit", async () => {
				process.env.storage_MAX_GB = "1"
				execFile.mockImplementation((_cmd, _args, cb) => cb(null, "2000000000\t/path\n"))
				query.mockImplementationOnce(() => Promise.resolve({ rows: [
					{ id: 1, camera: "1", name: "a.jpg", size: "600000000" },
					{ id: 2, camera: "1", name: "b.jpg", size: "600000000" },
					{ id: 3, camera: "1", name: "c.jpg", size: "600000000" }
				] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: true, deleted: 2 })
				expect(unlinkSpy).toHaveBeenCalledTimes(2)
				expect(query).toHaveBeenCalledTimes(2)
				expect(query.mock.calls[1][1]).toEqual([[1, 2]])
			})

			test("returns 500 on db error", async () => {
				process.env.storage_MAX_GB = "1"
				execFile.mockImplementation((_cmd, _args, cb) => cb(null, "2000000000\t/path\n"))
				query.mockRejectedValueOnce(new Error("db error"))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(500)
			})
		})
	})
})
