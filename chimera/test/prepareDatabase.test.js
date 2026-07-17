jest.mock("pg", () => ({ Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })) }))

const { Pool } = require("pg")
const { creationTasks, missingColumns, runCreationTasks } = require("../prepareDatabase.js")
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

	test("every CREATE TABLE task carries its table name and columns", () => {
		for (const t of creationTasks.filter(t => /CREATE TABLE/.test(t.query))) {
			expect(typeof t.table).toBe("string")
			expect(Array.isArray(t.columns)).toBe(true)
			expect(t.columns.length).toBeGreaterThan(0)
		}
	})

	const ddlColumns = (body) => {
		const defs = []
		let depth = 0
		let cur = ""
		for (const ch of body) {
			if (ch === "(") depth++
			else if (ch === ")") depth--
			else if (ch === "," && depth === 0) {
				defs.push(cur)
				cur = ""
				continue
			}
			cur += ch
		}
		defs.push(cur)
		return defs.map(d => d.trim().split(/\s+/)[0].toLowerCase())
	}

	test("every CREATE TABLE task's table and columns match its DDL", () => {
		for (const t of creationTasks.filter(t => /CREATE TABLE/.test(t.query))) {
			const [, name, body] = /CREATE TABLE (\w+)\((.*)\);/.exec(t.query)
			expect([t.table, t.columns]).toEqual([name.toLowerCase(), ddlColumns(body)])
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

describe("runCreationTasks", () => {
	const columnRows = (columns) => ({ rows: columns.map((c) => ({ column_name: c })) })

	beforeEach(() => {
		poolInstance.query.mockReset()
	})

	test("an existing table (42P07) with all expected columns reports ok", async () => {
		poolInstance.query.mockImplementation((query, params) => {
			if (/information_schema/.test(query)) {
				const task = creationTasks.find((t) => t.table === params[0])
				return Promise.resolve(columnRows(task.columns))
			}
			if (/CREATE TABLE/.test(query)) return Promise.reject({ code: "42P07" })
			return Promise.resolve({ rows: [] })
		})
		const issues = await runCreationTasks()
		expect(issues).toBe(false)
	})

	test("an existing table (42P07) missing expected columns reports issues", async () => {
		poolInstance.query.mockImplementation((query, params) => {
			if (/information_schema/.test(query)) {
				return params[0] === "auth" ? Promise.resolve(columnRows(["id", "username", "hash", "role"])) : Promise.resolve(columnRows(["id"]))
			}
			if (/CREATE TABLE/.test(query)) return Promise.reject({ code: "42P07" })
			return Promise.resolve({ rows: [] })
		})
		const issues = await runCreationTasks()
		expect(issues).toBe(true)
	})

	test("a non-42P07 failure reports the underlying error", async () => {
		const log = jest.spyOn(console, "log").mockImplementation(() => {})
		poolInstance.query.mockRejectedValue(Object.assign(new Error("permission denied for schema public"), { code: "42501" }))
		await expect(runCreationTasks()).resolves.toBe(true)
		expect(log).toHaveBeenCalledWith(expect.stringContaining("permission denied for schema public"))
		log.mockRestore()
	})

	test("a schema-check failure after 42P07 reports issues instead of throwing", async () => {
		poolInstance.query.mockImplementation((query) => {
			if (/information_schema/.test(query)) return Promise.reject(new Error("connection lost"))
			if (/CREATE TABLE/.test(query)) return Promise.reject({ code: "42P07" })
			return Promise.resolve({ rows: [] })
		})
		await expect(runCreationTasks()).resolves.toBe(true)
	})
})
