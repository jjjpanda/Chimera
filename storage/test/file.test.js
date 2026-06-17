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

	describe("/file/dailyStats", () => {
		afterEach(() => { delete process.env.cameras })

		test("maps rows to per-camera byte totals", async () => {
			process.env.cameras = JSON.stringify(["cam1", "cam2"])
			const ts = new Date("2026-06-11T10:00:00Z")
			query.mockImplementationOnce(() => Promise.resolve({ rows: [
				{ timestamp: ts, cam1: "100", cam2: "200" }
			] }))
			const res = await supertest(app)
				.get("/file/dailyStats")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(200)
			expect(res.body).toEqual([{ timestamp: ts.getTime(), cam1: 100, cam2: 200 }])
		})

		test("returns 500 on db error", async () => {
			process.env.cameras = JSON.stringify(["cam1"])
			query.mockRejectedValueOnce(new Error("db error"))
			const res = await supertest(app)
				.get("/file/dailyStats")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})
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
				expect(query).not.toHaveBeenCalled()
			})

			test("reports cleaned:false when frame usage is under target", async () => {
				process.env.storage_MAX_GB = "10"
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ used: "1000000" }] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: false })
				expect(query).toHaveBeenCalledTimes(1)
			})

			test("deletes oldest frames until under target when over limit", async () => {
				process.env.storage_MAX_GB = "1"
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ used: "2000000000" }] }))
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
				expect(query).toHaveBeenCalledTimes(3)
				expect(query.mock.calls[2][1]).toEqual([[1, 2]])
			})

			test("returns 500 on db error", async () => {
				process.env.storage_MAX_GB = "1"
				query.mockRejectedValueOnce(new Error("db error"))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(500)
			})
		})
	})
})
