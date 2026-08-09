jest.mock("pg", () => ({ Pool: jest.fn(() => ({ query: jest.fn(), on: jest.fn() })) }))

const { Pool } = require("pg")
const { creationTasks, columnDefinitions, missingColumns, runCreationTasks } = require("../prepareDatabase.js")
const poolConfig = Pool.mock.calls[0][0]
const poolInstance = Pool.mock.results[0].value

describe("prepareDatabase migration tasks", () => {
	const find = (re) => creationTasks.find(t => re.test(t.query))

	test("passes connectionTimeoutMillis to Pool", () => {
		expect(poolConfig.connectionTimeoutMillis).toBe(5000)
	})

	test("creates the auth table without temp_password_expires", () => {
		const t = find(/CREATE TABLE auth\b/)
		expect(t).toBeDefined()
		expect(t.query).toMatch(/force_password_change BOOLEAN/)
		expect(t.query).not.toMatch(/temp_password_expires/)
		expect(t.columns).not.toContain("temp_password_expires")
	})

	test("all CREATE TABLE timestamp columns are timestamptz, not naive", () => {
		for (const t of creationTasks.filter(t => /CREATE TABLE/.test(t.query))) {
			expect(t.query).not.toMatch(/TIMESTAMP(?!TZ)/)
		}
	})

	test("builds the indexes idempotently and without CONCURRENTLY", () => {
		const idx = creationTasks.filter(t => /CREATE (UNIQUE )?INDEX/.test(t.query))
		expect(idx).toHaveLength(7)
		for (const t of idx) {
			expect(t.query).toMatch(/CREATE (UNIQUE )?INDEX IF NOT EXISTS/)
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

	test("every CREATE TABLE column carries a definition an ALTER TABLE can reuse", () => {
		for (const t of creationTasks.filter(t => /CREATE TABLE/.test(t.query))) {
			const definitions = columnDefinitions(t.query)
			expect(Object.keys(definitions)).toEqual(t.columns)
			for (const column of t.columns) expect(definitions[column].trim()).not.toBe("")
		}
	})

	test("columnDefinitions keeps types, sizes and defaults intact", () => {
		const auth = columnDefinitions(creationTasks.find(t => t.table === "auth").query)
		expect(auth.language).toBe("VARCHAR(10) DEFAULT 'en'")
		expect(auth.theme).toBe("VARCHAR(10) DEFAULT 'system'")
		expect(auth.force_password_change).toBe("BOOLEAN NOT NULL DEFAULT FALSE")
		expect(columnDefinitions("CREATE INDEX IF NOT EXISTS idx ON t(a);")).toEqual({})
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

	test("an existing table (42P07) missing expected columns adds them instead of demanding a wipe", async () => {
		const log = jest.spyOn(console, "log").mockImplementation(() => {})
		poolInstance.query.mockImplementation((query, params) => {
			if (/information_schema/.test(query)) {
				if (params[0] === "auth") return Promise.resolve(columnRows(["id", "username", "hash", "role", "last_login", "force_password_change"]))
				return Promise.resolve(columnRows(creationTasks.find((t) => t.table === params[0]).columns))
			}
			if (/CREATE TABLE/.test(query)) return Promise.reject({ code: "42P07" })
			return Promise.resolve({ rows: [] })
		})
		await expect(runCreationTasks()).resolves.toBe(false)
		expect(poolInstance.query).toHaveBeenCalledWith("ALTER TABLE auth ADD COLUMN IF NOT EXISTS theme VARCHAR(10) DEFAULT 'system';")
		expect(poolInstance.query).toHaveBeenCalledWith("ALTER TABLE auth ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';")
		expect(log).toHaveBeenCalledWith(expect.stringContaining("added missing columns: theme, language"))
		expect(log).not.toHaveBeenCalledWith(expect.stringContaining("docker:delete"))
		log.mockRestore()
	})

	test("an older auth table adds every column it lacks, in DDL order", async () => {
		poolInstance.query.mockImplementation((query, params) => {
			if (/information_schema/.test(query)) {
				if (params[0] === "auth") return Promise.resolve(columnRows(["id", "username", "hash"]))
				return Promise.resolve(columnRows(creationTasks.find((t) => t.table === params[0]).columns))
			}
			if (/CREATE TABLE/.test(query)) return Promise.reject({ code: "42P07" })
			return Promise.resolve({ rows: [] })
		})
		await expect(runCreationTasks()).resolves.toBe(false)
		const altered = poolInstance.query.mock.calls.map(([q]) => q).filter((q) => /^ALTER TABLE auth/.test(q))
		expect(altered).toEqual([
			"ALTER TABLE auth ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user';",
			"ALTER TABLE auth ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;",
			"ALTER TABLE auth ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE;",
			"ALTER TABLE auth ADD COLUMN IF NOT EXISTS theme VARCHAR(10) DEFAULT 'system';",
			"ALTER TABLE auth ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';"
		])
	})

	test("a column that cannot be added still reports issues and how to start fresh", async () => {
		const log = jest.spyOn(console, "log").mockImplementation(() => {})
		poolInstance.query.mockImplementation((query, params) => {
			if (/information_schema/.test(query)) {
				if (params[0] === "auth") return Promise.resolve(columnRows(["id", "username", "hash", "role", "last_login", "force_password_change", "theme"]))
				return Promise.resolve(columnRows(creationTasks.find((t) => t.table === params[0]).columns))
			}
			if (/ALTER TABLE/.test(query)) return Promise.reject(new Error("permission denied for table auth"))
			if (/CREATE TABLE/.test(query)) return Promise.reject({ code: "42P07" })
			return Promise.resolve({ rows: [] })
		})
		await expect(runCreationTasks()).resolves.toBe(true)
		expect(log).toHaveBeenCalledWith(expect.stringContaining("missing columns: language. Run 'npm run docker:delete'"))
		// docker:delete is `compose down -v`, which never touches the /etc/letsencrypt bind mount
		expect(log).not.toHaveBeenCalledWith(expect.stringContaining("footage/certs"))
		log.mockRestore()
	})

	test("a non-42P07 failure reports the underlying error", async () => {
		const log = jest.spyOn(console, "log").mockImplementation(() => {})
		poolInstance.query.mockRejectedValue(Object.assign(new Error("permission denied for schema public"), { code: "42501" }))
		await expect(runCreationTasks()).resolves.toBe(true)
		expect(log).toHaveBeenCalledWith(expect.stringContaining("permission denied for schema public"))
		log.mockRestore()
	})

	test("a unique index blocked by duplicate rows (23505) dedupes and retries", async () => {
		let attempts = 0
		poolInstance.query.mockImplementation((query) => {
			if (/CREATE UNIQUE INDEX/.test(query)) {
				attempts++
				return attempts === 1 ? Promise.reject({ code: "23505" }) : Promise.resolve({ rows: [] })
			}
			return Promise.resolve({ rows: [] })
		})
		await expect(runCreationTasks()).resolves.toBe(false)
		expect(attempts).toBe(2)
		expect(poolInstance.query).toHaveBeenCalledWith(expect.stringContaining("a.id > b.id"))
	})

	test("a dedupe failure after 23505 reports issues instead of throwing", async () => {
		const log = jest.spyOn(console, "log").mockImplementation(() => {})
		poolInstance.query.mockImplementation((query) => {
			if (/CREATE UNIQUE INDEX/.test(query)) return Promise.reject({ code: "23505" })
			if (/^DELETE FROM frame_files/.test(query)) return Promise.reject(new Error("permission denied for table frame_files"))
			return Promise.resolve({ rows: [] })
		})
		await expect(runCreationTasks()).resolves.toBe(true)
		expect(log).toHaveBeenCalledWith(expect.stringContaining("permission denied for table frame_files"))
		log.mockRestore()
	})

	test("a retried index creation that still fails after a successful dedupe reports issues instead of throwing", async () => {
		const log = jest.spyOn(console, "log").mockImplementation(() => {})
		poolInstance.query.mockImplementation((query) => {
			if (/CREATE UNIQUE INDEX/.test(query)) return Promise.reject({ code: "23505", message: "duplicate key value violates unique constraint" })
			if (/^DELETE FROM frame_files/.test(query)) return Promise.resolve({ rowCount: 2 })
			return Promise.resolve({ rows: [] })
		})
		await expect(runCreationTasks()).resolves.toBe(true)
		expect(log).toHaveBeenCalledWith(expect.stringContaining("duplicate rows removed but index creation still failed: duplicate key value violates unique constraint"))
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
