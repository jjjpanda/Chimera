jest.mock("pg", () => ({ Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })) }))

const { creationTasks } = require("../prepareDatabase.js")

describe("prepareDatabase migration tasks", () => {
	const find = (re) => creationTasks.find(t => re.test(t.query))

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

	test("builds the camera/timestamp indexes concurrently and idempotently", () => {
		const idx = creationTasks.filter(t => /CREATE INDEX/.test(t.query))
		expect(idx).toHaveLength(3)
		for (const t of idx) {
			expect(t.query).toMatch(/CREATE INDEX CONCURRENTLY IF NOT EXISTS/)
		}
	})

	test("every task exposes a query string and a description", () => {
		for (const t of creationTasks) {
			expect(typeof t.query).toBe("string")
			expect(typeof t.description).toBe("string")
		}
	})
})
