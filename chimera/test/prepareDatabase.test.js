jest.mock("pg", () => ({ Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })) }))

const { Pool } = require("pg")
const { creationTasks } = require("../prepareDatabase.js")
const poolConfig = Pool.mock.calls[0][0]

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
		expect(idx).toHaveLength(6)
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
})
