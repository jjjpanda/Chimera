process.env.storage_FOLDERPATH = "/tmp/storage-database-test"

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")
jest.mock("pg", () => {
	const pools = []
	const Pool = jest.fn((config) => {
		const pool = {
			config,
			query: jest.fn(() => Promise.resolve({ rows: [{ "?column?": 4 }] })),
			connect: jest.fn(),
			on: jest.fn()
		}
		pools.push(pool)
		return pool
	})
	return { Pool, __pools: pools }
})

const supertest = require("supertest")
const app = require("../backend/storage.js")

const { BULK_TIMEOUT_MS } = require("../backend/lib/pool.js")
const pools = require("pg").__pools
const { query } = pools.find((p) => p.config.statement_timeout !== BULK_TIMEOUT_MS)
const { query: bulkQuery } = pools.find((p) => p.config.statement_timeout === BULK_TIMEOUT_MS)

const status = () => supertest(app).get("/database/status").set("Cookie", "validCookie")

describe("/database/status", () => {
	test("reports healthy on a round trip the database actually answered", async () => {
		const res = await status()
		expect(res.status).toBe(200)
		expect(query).toHaveBeenCalledWith("SELECT 2 + 2;")
	})

	test("probes on the request pool, so a wedged database is reported down within the request budget", async () => {
		await status()
		expect(bulkQuery).not.toHaveBeenCalled()
	})

	test("reports down when the probe times out rather than reporting healthy", async () => {
		query.mockRejectedValueOnce(new Error("Query read timeout"))
		const res = await status()
		expect(res.status).toBe(204)
	})

	test("reports down when the round trip comes back with the wrong answer", async () => {
		query.mockResolvedValueOnce({ rows: [{ "?column?": 5 }] })
		const res = await status()
		expect(res.status).toBe(204)
	})

	test("reports down when the round trip comes back empty", async () => {
		query.mockResolvedValueOnce({ rows: [] })
		const res = await status()
		expect(res.status).toBe(204)
	})
})
