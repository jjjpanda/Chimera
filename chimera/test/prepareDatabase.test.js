jest.mock("pg", () => ({ Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })) }))

const { Pool } = require("pg")
const { creationTasks, missingColumns } = require("../prepareDatabase.js")
const poolConfig = Pool.mock.calls[0][0]
const poolInstance = Pool.mock.results[0].value

describe("prepareDatabase migration tasks", () => {
	const find = (re) => creationTasks.find(t => re.test(t.query))

	test("passes connectionTimeoutMillis to Pool", () => {
		expect(poolConfig.connectionTimeoutMillis).toBe(5000)
	})

	test("creates the auth table with temp_password_expires", () => {
		const t = find(/CREATE TABLE auth\b/)
		expect(t).toBeDefined()
		expect(t.query).toMatch(/temp_password_expires TIMESTAMPTZ/)
	})

	test("all CREATE TABLE timestamp columns are timestamptz, not naive", () => {
		for (const t of creationTasks.filter(t => /CREATE TABLE/.test(t.query))) {
			expect(t.query).not.toMatch(/TIMESTAMP(?!TZ)/)
		}
	})

	test("builds the indexes idempotently and without CONCURRENTLY", () => {
		const idx = creationTasks.filter(t => /CREATE INDEX/.test(t.query))
		expect(idx).toHaveLength(5)
		for (const t of idx) {
			expect(t.query).toMatch(/CREATE INDEX IF NOT EXISTS/)
			expect(t.query).not.toMatch(/CONCURRENTLY/)
		}
	})

	test("every task exposes a query string and a description", () => {
		for (const t of creationTasks) {
			expect(typeof t.query).toBe("string")
			expect(typeof t.description).toBe("string")
		}
	})

	test("every CREATE TABLE task carries its table name and columns", () => {
		for (const t of creationTasks.filter(t => /CREATE TABLE/.test(t.query))) {
			expect(typeof t.table).toBe("string")
			expect(Array.isArray(t.columns)).toBe(true)
			expect(t.columns.length).toBeGreaterThan(0)
		}
	})

	test("missingColumns reports columns absent from information_schema", async () => {
		poolInstance.query.mockResolvedValueOnce({ rows: [{ column_name: "id" }, { column_name: "username" }, { column_name: "hash" }] })
		const missing = await missingColumns("auth", ["id", "username", "hash", "role", "theme"])
		expect(missing).toEqual(["role", "theme"])
	})

	test("missingColumns reports nothing when the schema matches", async () => {
		poolInstance.query.mockResolvedValueOnce({ rows: [{ column_name: "id" }, { column_name: "url" }] })
		const missing = await missingColumns("scheduled_tasks", ["id", "url"])
		expect(missing).toEqual([])
	})
})
