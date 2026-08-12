process.env.SECRETKEY = "test-secret"
process.env.command_COOKIE_SECURE = "false"

jest.mock("pg")
jest.mock("pm2")
jest.mock("axios")
jest.mock("memory")

const supertest = require("supertest")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const app = require("../backend/command.js")
const { auth } = require("lib")

const { mockedPool } = require("pg")

describe("Authorization Routes", () => {
	beforeEach(() => {
		delete process.env.setup_TOKEN
		auth.invalidateAllSessions()
	})

	afterEach(() => jest.restoreAllMocks())

	describe("GET /authorization/status", () => {
		test("returns setup: false when table is empty", async () => {
			const res = await supertest(app).get("/authorization/status")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ setup: false, tokenRequired: false })
		})

		test("returns setup: true when table has rows", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ count: "1" }] })
			const res = await supertest(app).get("/authorization/status")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ setup: true })
		})
	})

	describe("POST /authorization/setup", () => {
		test("returns 200 on first-time setup with a valid setup_TOKEN", async () => {
			process.env.setup_TOKEN = "boot-token"
			const spy = jest.spyOn(auth, "invalidateUser")
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 0 }) // no admin exists
			mockedPool.query.mockResolvedValueOnce({ rows: [] }) // target is a new user
			mockedPool.query.mockResolvedValueOnce({ rowCount: 1 }) // upsert
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "correct-horse-battery", token: "boot-token" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(spy).toHaveBeenCalled()
		})

		test("refuses setup without disclosing that setup_TOKEN is unconfigured", async () => {
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "correct-horse-battery" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: true, errors: "SETUP_TOKEN_MISMATCH" })
			expect(mockedPool.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO auth"), expect.anything())
		})

		test("allows admin recovery with a valid setup_TOKEN when no admin exists", async () => {
			process.env.setup_TOKEN = "recovery-token"
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 0 }) // no admin exists
			mockedPool.query.mockResolvedValueOnce({ rows: [] }) // target is a new user
			mockedPool.query.mockResolvedValueOnce({ rowCount: 1 }) // upsert
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "newadmin", password: "correct-horse-battery", token: "recovery-token" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("rejects resetting an existing admin while an admin exists", async () => {
			process.env.setup_TOKEN = "recovery-token"
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 1 }) // an admin already exists
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }] }) // target is that admin
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "existingadmin", password: "newpassword123", token: "recovery-token" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: true })
			expect(mockedPool.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO auth"), expect.anything())
			expect(mockedPool.query).not.toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE username = $1", ["existingadmin"])
		})

		test("rejects taking over an existing non-admin account when no admin exists", async () => {
			process.env.setup_TOKEN = "recovery-token"
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 0 }) // no admin exists
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "user" }] }) // target is an existing non-admin
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "victim", password: "correct-horse-battery", token: "recovery-token" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: true })
			expect(mockedPool.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO auth"), expect.anything())
			expect(mockedPool.query).not.toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE username = $1", ["victim"])
		})

		test("rejects taking over a non-admin account while an admin exists", async () => {
			process.env.setup_TOKEN = "recovery-token"
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 1 }) // an admin already exists
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "user" }] }) // target is a non-admin
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "victim", password: "correct-horse-battery", token: "recovery-token" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: true })
			expect(mockedPool.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO auth"), expect.anything())
			expect(mockedPool.query).not.toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE username = $1", ["victim"])
		})

		test("rejects minting a second admin while an admin exists", async () => {
			process.env.setup_TOKEN = "recovery-token"
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 1 }) // an admin already exists
			mockedPool.query.mockResolvedValueOnce({ rows: [] }) // target is a new user
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "second-admin", password: "correct-horse-battery", token: "recovery-token" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: true })
			expect(mockedPool.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO auth"), expect.anything())
		})

		test("rejects setup with an invalid setup_TOKEN and names the token", async () => {
			process.env.setup_TOKEN = "right-token"
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "correct-horse-battery", token: "wrong-token" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: true, errors: "SETUP_TOKEN_MISMATCH" })
		})

		test("returns 400 when username or password is missing", async () => {
			process.env.setup_TOKEN = "boot-token"
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", token: "boot-token" })
			expect(res.status).toBe(400)
			expect(res.body.error).toBe(true)
		})

		test("returns 400 for username containing slash", async () => {
			process.env.setup_TOKEN = "boot-token"
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "bad/admin", password: "correct-horse-battery", token: "boot-token" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "INVALID_USERNAME" })
		})

		test("returns 400 for a password shorter than the minimum length", async () => {
			process.env.setup_TOKEN = "boot-token"
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "short", token: "boot-token" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "PASSWORD_TOO_SHORT" })
		})

		test("returns 500 when the transaction throws a generic error", async () => {
			process.env.setup_TOKEN = "boot-token"
			const errSpy = jest.spyOn(console, "error").mockImplementation(() => {})
			mockedPool.query.mockRejectedValueOnce(new Error("db down"))
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "correct-horse-battery", token: "boot-token" })
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
			expect(errSpy).toHaveBeenCalled()
			errSpy.mockRestore()
		})

		test("rejects a cross-site POST with 403", async () => {
			process.env.setup_TOKEN = "boot-token"
			const res = await supertest(app)
				.post("/authorization/setup")
				.set("Sec-Fetch-Site", "cross-site")
				.send({ username: "admin", password: "correct-horse-battery", token: "boot-token" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: "forbidden" })
			expect(mockedPool.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO auth"), expect.anything())
		})

		test("allows a same-origin POST", async () => {
			process.env.setup_TOKEN = "boot-token"
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 0 }) // no admin exists
			mockedPool.query.mockResolvedValueOnce({ rows: [] }) // target is a new user
			mockedPool.query.mockResolvedValueOnce({ rowCount: 1 }) // upsert
			const res = await supertest(app)
				.post("/authorization/setup")
				.set("Sec-Fetch-Site", "same-origin")
				.send({ username: "admin", password: "correct-horse-battery", token: "boot-token" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})
	})

	describe("POST /authorization/login", () => {
		afterEach(() => {
			process.env.command_COOKIE_SECURE = "false"
			jest.resetModules()
		})

		test("returns 400 with wrong credentials", async () => {
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: "admin", password: "wrongpassword" })
			expect(res.status).toBe(400)
		})

		test("returns 200 and sets bearertoken cookie with correct credentials", async () => {
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: "admin", password: "mockedPassword" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false, role: "user", theme: "system", language: "en" })
			expect(res.headers["set-cookie"]).toBeDefined()
			expect(res.headers["set-cookie"][0]).toMatch(/^bearertoken=/)
			expect(res.headers["set-cookie"][0]).not.toMatch(/; ?Secure/i)
		})

		test("sets Secure attribute on bearertoken cookie when command_COOKIE_SECURE=true", async () => {
			jest.resetModules()
			process.env.command_COOKIE_SECURE = "true"
			const freshApp = require("../backend/command.js")
			const res = await supertest(freshApp)
				.post("/authorization/login")
				.send({ username: "admin", password: "mockedPassword" })
			expect(res.status).toBe(200)
			expect(res.headers["set-cookie"][0]).toMatch(/; ?Secure/i)
		})

		test("omits Secure attribute on bearertoken cookie regardless of X-Forwarded-Proto", async () => {
			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-Proto", "https")
				.send({ username: "admin", password: "mockedPassword" })
			expect(res.status).toBe(200)
			expect(res.headers["set-cookie"][0]).not.toMatch(/; ?Secure/i)
		})

		test("allows login with a forced temp password regardless of age", async () => {
			const hash = bcrypt.hashSync("temppass123", 10)
			mockedPool.query.mockImplementationOnce((str, params, cb) => {
				const result = { rows: [{ hash, role: "user", force_password_change: true }], rowCount: 1 }
				cb(null, result)
				return Promise.resolve(result)
			})
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: "bob", password: "temppass123" })
			expect(res.status).toBe(200)
			expect(res.body.error).toBe(false)
			expect(res.body.forcePasswordChange).toBe(true)
		})

		test("returns 500 when token signing fails", async () => {
			const signSpy = jest.spyOn(jwt, "sign").mockImplementationOnce((payload, key, opts, cb) => cb(new Error("sign failed")))
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: "admin", password: "mockedPassword" })
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
			signSpy.mockRestore()
		})

		test("returns 500 when the login query errors", async () => {
			mockedPool.query.mockImplementationOnce((str, params, cb) => {
				cb(new Error("db down"))
				return Promise.resolve()
			})
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: "admin", password: "mockedPassword" })
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 500 when password comparison errors", async () => {
			jest.spyOn(bcrypt, "compare").mockImplementationOnce((pw, hash, cb) => cb(new Error("bcrypt fail")))
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: "admin", password: "mockedPassword" })
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})

		test("rejects a cross-site POST with 403", async () => {
			const res = await supertest(app)
				.post("/authorization/login")
				.set("Sec-Fetch-Site", "cross-site")
				.send({ username: "admin", password: "mockedPassword" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: "forbidden" })
		})

		test("allows a same-origin POST", async () => {
			const res = await supertest(app)
				.post("/authorization/login")
				.set("Sec-Fetch-Site", "same-origin")
				.send({ username: "admin", password: "mockedPassword" })
			expect(res.status).toBe(200)
		})

		test("answers a username that cannot be coerced to a string", async () => {
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: { toString: 1 }, password: "x" })
			expect(res.status).toBe(400)
		})
	})

	describe("POST /authorization/verify", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/authorization/verify")
			expect(res.status).toBe(401)
		})

		test("returns 200 with valid bearertoken", async () => {
			const token = jwt.sign({ username: "test", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/verify")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false, role: "user", forcePasswordChange: false, theme: "system", language: "en" })
		})

		test("returns 401 for valid JWT of deleted user", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			const token = jwt.sign({ username: "deleted", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/verify")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(401)
			expect(res.body).toEqual({ error: "unauthorized" })
		})
	})

	describe("CSRF protection on cookie-authed routes", () => {
		const token = jwt.sign({ username: "test", role: "user", jti: "jti-user" }, "test-secret")

		test("rejects a cross-site POST with 403", async () => {
			const res = await supertest(app)
				.post("/authorization/verify")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.set("Sec-Fetch-Site", "cross-site")
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: "forbidden" })
		})

		test("allows a same-origin POST", async () => {
			const res = await supertest(app)
				.post("/authorization/verify")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.set("Sec-Fetch-Site", "same-origin")
			expect(res.status).toBe(200)
		})
	})

	describe("PUT /authorization/theme", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).put("/authorization/theme").send({ theme: "light" })
			expect(res.status).toBe(401)
		})

		test("returns 400 for an invalid theme value", async () => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.put("/authorization/theme")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ theme: "blue" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true })
		})

		test.each(["light", "dark", "system"])("returns 200 on successful theme update (%s)", async (theme) => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.put("/authorization/theme")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ theme })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})
	})

	describe("PUT /authorization/language", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).put("/authorization/language").send({ language: "es" })
			expect(res.status).toBe(401)
		})

		test("returns 400 for a language outside the allow-list", async () => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.put("/authorization/language")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ language: "xx" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true })
		})

		test.each(require("lib").languages)("returns 200 on successful language update (%s)", async (language) => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.put("/authorization/language")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ language })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})
	})

	describe("GET /authorization/users", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).get("/authorization/users")
			expect(res.status).toBe(401)
		})

		test("redirects a browser navigation with no token", async () => {
			const res = await supertest(app).get("/authorization/users").set("Sec-Fetch-Mode", "navigate")
			expect(res.status).toBe(303)
		})

		test("returns 403 for non-admin token", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "user", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "test", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.get("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(403)
		})

		test("returns 200 with user list for admin", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ username: "admin", role: "admin" }] })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.get("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual([{ username: "admin", role: "admin" }])
		})
	})

	describe("POST /authorization/users", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/authorization/users").send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(401)
		})

		test("returns 403 for non-admin token", async () => {
			const token = jwt.sign({ username: "test", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(403)
		})

		test("returns 400 for missing fields", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob" })
			expect(res.status).toBe(400)
		})

		test("returns 400 for invalid role", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "superuser" })
			expect(res.status).toBe(400)
		})

		test("returns 400 for username containing slash", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bad/user", password: "pass", role: "user" })
			expect(res.status).toBe(400)
		})

		test("returns 200 on successful user creation", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false, tempPassword: expect.any(String) })
		})

		test("returns 400 for duplicate username", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockRejectedValueOnce({ code: "23505" })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 500 for non-duplicate db error", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockRejectedValueOnce({ code: "08006" })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})
	})

	describe("PATCH /authorization/users/:username", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).patch("/authorization/users/bob").send({ role: "admin" })
			expect(res.status).toBe(401)
		})

		test("returns 403 for non-admin token", async () => {
			const token = jwt.sign({ username: "test", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "admin" })
			expect(res.status).toBe(403)
		})

		test("returns 400 when no role or password provided", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ foo: true })
			expect(res.status).toBe(400)
		})

		test("returns 400 for invalid role", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "superuser" })
			expect(res.status).toBe(400)
		})

		test("returns 404 when user does not exist", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/nobody")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "admin" })
			expect(res.status).toBe(404)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 200 when updating role", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const spy = jest.spyOn(auth, "invalidateUser")
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "admin" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE username = $1 AND jti IS DISTINCT FROM $2", ["bob", "jti-admin"])
			expect(spy).toHaveBeenCalled()
		})

		test("returns 200 when updating password and forces a change on next login", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const spy = jest.spyOn(auth, "invalidateUser")
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "replacement-passphrase" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith(
				"UPDATE auth SET hash = $1, force_password_change = $2 WHERE username = $3",
				[expect.any(String), true, "bob"]
			)
			expect(mockedPool.query).toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE username = $1 AND jti IS DISTINCT FROM $2", ["bob", "jti-admin"])
			expect(spy).toHaveBeenCalled()
		})

		test("does not force a change when an admin updates their own password", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/admin")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "replacement-passphrase" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith(
				"UPDATE auth SET hash = $1, force_password_change = $2 WHERE username = $3",
				[expect.any(String), false, "admin"]
			)
		})

		test("returns 400 for a password shorter than the minimum length", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "short" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "PASSWORD_TOO_SHORT" })
		})

		test("returns 400 when demoting last admin", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ username: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/other")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "user" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "CANNOT_DEMOTE_LAST_ADMIN" })
		})
	})

	describe("DELETE /authorization/users/:username", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).delete("/authorization/users/bob")
			expect(res.status).toBe(401)
		})

		test("returns 403 for non-admin token", async () => {
			const token = jwt.sign({ username: "test", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(403)
		})

		test("returns 400 when deleting own account", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/admin")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(400)
		})

		test("returns 200 on successful deletion", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const spy = jest.spyOn(auth, "invalidateUser")
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(spy).toHaveBeenCalled()
		})

		test("returns 404 when user does not exist", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/nobody")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(404)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 200 when deleting admin with multiple admins", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ username: "admin" }, { username: "other" }], rowCount: 2 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/other")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("returns 400 when deleting last admin", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ username: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/other")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "CANNOT_DELETE_LAST_ADMIN" })
		})
	})

	describe("GET /authorization/users/:username/sessions", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).get("/authorization/users/bob/sessions")
			expect(res.status).toBe(401)
		})

		test("returns 403 for non-admin token", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "user", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "test", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.get("/authorization/users/bob/sessions")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(403)
		})

		test("returns 200 with session list for admin", async () => {
			const sessions = [{ id: 1, issued_at: "t", last_seen: null, ip: "1.2.3.4", user_agent: "ua", revoked: false }]
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: sessions })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.get("/authorization/users/bob/sessions")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual(sessions)
		})
	})

	describe("DELETE /authorization/sessions/:id", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).delete("/authorization/sessions/1")
			expect(res.status).toBe(401)
		})

		test("returns 403 for non-admin token", async () => {
			const token = jwt.sign({ username: "test", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/sessions/1")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(403)
		})

		test("returns 400 for non-numeric id", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/sessions/abc")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 404 when session does not exist", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/sessions/999")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(404)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 200 on successful revoke", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ jti: "jti-victim" }], rowCount: 1 })
			const spy = jest.spyOn(auth, "invalidateSession")
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/sessions/5")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE id = $1 RETURNING jti", [5])
			expect(spy).toHaveBeenCalledWith("jti-victim")
		})
	})

	describe("POST /authorization/password", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/authorization/password").send({ password: "replacement-passphrase" })
			expect(res.status).toBe(401)
		})

		test("returns 400 for a password shorter than the minimum length", async () => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "short" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "PASSWORD_TOO_SHORT" })
		})

		test("returns 200 for a voluntary change with the correct current password", async () => {
			const spy = jest.spyOn(auth, "invalidateUser")
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "replacement-passphrase", currentPassword: "mockedPassword" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith(
				"UPDATE auth SET hash = $1, force_password_change = FALSE WHERE username = $2",
				expect.arrayContaining(["bob"])
			)
			expect(mockedPool.query).toHaveBeenCalledWith(
				"UPDATE sessions SET revoked = TRUE WHERE username = $1 AND jti IS DISTINCT FROM $2",
				["bob", "jti-user"]
			)
			expect(spy).toHaveBeenCalled()
		})

		test("returns 400 for a voluntary change with a wrong current password", async () => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "replacement-passphrase", currentPassword: "wrongpass" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "WRONG_CURRENT_PASSWORD" })
			expect(mockedPool.query).not.toHaveBeenCalledWith(
				"UPDATE auth SET hash = $1, force_password_change = FALSE WHERE username = $2",
				expect.anything()
			)
		})

		test("allows a forced change without the current password", async () => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			mockedPool.query
				.mockResolvedValueOnce({ rows: [{ role: "user", force_password_change: true, revoked: false, last_seen: new Date() }], rowCount: 1 }) // authorize session lookup
				.mockResolvedValueOnce({}) // BEGIN
				.mockResolvedValueOnce({ rows: [{ hash: "irrelevant", force_password_change: true }], rowCount: 1 }) // SELECT current
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "replacement-passphrase" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("locks the account out after repeated wrong current-password guesses", async () => {
			const token = jwt.sign({ username: "guessme", role: "user", jti: "jti-guess" }, "test-secret")
			let res
			for (let i = 0; i < 6; i++) {
				res = await supertest(app)
					.post("/authorization/password")
					.set("Cookie", `bearertoken=Bearer%20${token}`)
					.send({ password: "replacement-passphrase", currentPassword: `wrong${i}` })
			}
			expect(res.status).toBe(429)
			expect(res.body).toEqual({ error: true, errors: "TOO_MANY_ATTEMPTS" })
		})

		test("does not hash the new password when the current password is wrong", async () => {
			const spy = jest.spyOn(bcrypt, "genSalt")
			const token = jwt.sign({ username: "unhashed", role: "user", jti: "jti-unhashed" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "replacement-passphrase", currentPassword: "wrongpass" })
			expect(res.status).toBe(400)
			expect(spy).not.toHaveBeenCalled()
		})
	})

	describe("POST /authorization/logout", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/authorization/logout")
			expect(res.status).toBe(401)
		})

		test("revokes the session jti and clears the cookie", async () => {
			const spy = jest.spyOn(auth, "invalidateSession")
			const token = jwt.sign({ username: "bob", role: "user", jti: "sess-1" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/logout")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE jti = $1", ["sess-1"])
			expect(res.headers["set-cookie"][0]).toMatch(/^bearertoken=;/)
			expect(spy).toHaveBeenCalledWith("sess-1")
		})
	})

	describe("rateLimit", () => {
		const { rateLimit } = require("../backend/routes/authorization.js")

		const flush = () => new Promise(setImmediate)

		const run = (mw, ip, statusCode = 400) => {
			const req = { headers: {}, ip, path: "/login" }
			let onFinish
			const res = {
				statusCode,
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
				on: (event, fn) => { if (event === "finish") onFinish = fn }
			}
			const next = jest.fn(() => onFinish && onFinish())
			mw(req, res, next)
			return { res, next }
		}

		test("allows up to max failures then returns 429", () => {
			const mw = rateLimit({ windowMs: 60000, max: 3 })
			expect(run(mw, "1.1.1.1").next).toHaveBeenCalled()
			expect(run(mw, "1.1.1.1").next).toHaveBeenCalled()
			expect(run(mw, "1.1.1.1").next).toHaveBeenCalled()
			const { res, next } = run(mw, "1.1.1.1")
			expect(next).not.toHaveBeenCalled()
			expect(res.status).toHaveBeenCalledWith(429)
		})

		test("tracks separate ips independently", () => {
			const mw = rateLimit({ windowMs: 60000, max: 1 })
			expect(run(mw, "2.2.2.2").next).toHaveBeenCalled()
			expect(run(mw, "3.3.3.3").next).toHaveBeenCalled()
			expect(run(mw, "2.2.2.2").res.status).toHaveBeenCalledWith(429)
		})

		test("does not count successful logins toward the limit", () => {
			const mw = rateLimit({ windowMs: 60000, max: 1 })
			run(mw, "4.4.4.4", 200)
			run(mw, "4.4.4.4", 200)
			expect(run(mw, "4.4.4.4", 200).next).toHaveBeenCalled()
		})

		test("counts an aborted request that never fires finish against the limit", () => {
			const mw = rateLimit({ windowMs: 60000, max: 1 })
			const req = { headers: {}, ip: "5.5.5.5", path: "/login" }
			const res = { statusCode: 200, status: jest.fn().mockReturnThis(), json: jest.fn(), on: jest.fn() }
			const next = jest.fn()
			mw(req, res, next)
			expect(next).toHaveBeenCalled()
			const second = run(mw, "5.5.5.5")
			expect(second.next).not.toHaveBeenCalled()
			expect(second.res.status).toHaveBeenCalledWith(429)
		})

		test("with throttleMs, a spent budget lets exactly one request through per window, then blocks", () => {
			const mw = rateLimit({ windowMs: 60000, max: 1, throttleMs: 60000 })
			expect(run(mw, "15.15.15.15").next).toHaveBeenCalled()
			expect(run(mw, "15.15.15.15").next).toHaveBeenCalled()
			const { res, next } = run(mw, "15.15.15.15")
			expect(next).not.toHaveBeenCalled()
			expect(res.status).toHaveBeenCalledWith(429)
		})

		test("skip resolving true bypasses the limiter entirely, even after the budget is spent", async () => {
			const mw = rateLimit({ windowMs: 60000, max: 1, skip: async () => true })
			const makeReq = (ip) => ({ headers: {}, ip, path: "/login" })
			const makeRes = () => ({ statusCode: 400, status: jest.fn().mockReturnThis(), json: jest.fn(), on: jest.fn() })

			const next1 = jest.fn()
			mw(makeReq("16.16.16.16"), makeRes(), next1)
			await flush()
			expect(next1).toHaveBeenCalled()

			const res2 = makeRes()
			const next2 = jest.fn()
			mw(makeReq("16.16.16.16"), res2, next2)
			await flush()
			expect(next2).toHaveBeenCalled()
			expect(res2.status).not.toHaveBeenCalled()
		})

		test("skip resolving false runs the limiter as normal", async () => {
			const mw = rateLimit({ windowMs: 60000, max: 1, skip: async () => false })
			const makeReq = (ip) => ({ headers: {}, ip, path: "/login" })
			const makeRes = () => ({ statusCode: 400, status: jest.fn().mockReturnThis(), json: jest.fn(), on: jest.fn() })

			const next1 = jest.fn()
			mw(makeReq("17.17.17.17"), makeRes(), next1)
			await flush()
			expect(next1).toHaveBeenCalled()

			const res2 = makeRes()
			const next2 = jest.fn()
			mw(makeReq("17.17.17.17"), res2, next2)
			await flush()
			expect(next2).not.toHaveBeenCalled()
			expect(res2.status).toHaveBeenCalledWith(429)
		})

		test("a chain refuses on the first spent budget, and hands back what the later ones reserved", () => {
			const { rateLimitChain } = require("../backend/routes/authorization.js")
			const mw = rateLimitChain([
				{ windowMs: 60000, max: 1, keyFn: (req) => `chain:ip:${req.ip}` },
				{ windowMs: 60000, max: 3, keyFn: () => "chain:shared" },
			])
			expect(run(mw, "9.9.9.1").next).toHaveBeenCalled()
			expect(run(mw, "9.9.9.1").res.status).toHaveBeenCalledWith(429)
			expect(run(mw, "9.9.9.1").res.status).toHaveBeenCalledWith(429)
			expect(run(mw, "9.9.9.2").next).toHaveBeenCalled()
			expect(run(mw, "9.9.9.3").next).toHaveBeenCalled()
			expect(run(mw, "9.9.9.4").res.status).toHaveBeenCalledWith(429)
		})

		test("a throttled-through budget still lets the later ones decide", () => {
			const { rateLimitChain } = require("../backend/routes/authorization.js")
			const mw = rateLimitChain([
				{ windowMs: 60000, max: 1, throttleMs: 60000, keyFn: (req) => `throttled:ip:${req.ip}` },
				{ windowMs: 60000, max: 1, keyFn: () => "throttled:account" },
			])
			expect(run(mw, "9.9.8.1").next).toHaveBeenCalled()
			expect(run(mw, "9.9.8.1").res.status).toHaveBeenCalledWith(429)
		})

		test("a request the first budget throttles through still spends the later ones", () => {
			const { rateLimitChain } = require("../backend/routes/authorization.js")
			const mw = rateLimitChain([
				{ windowMs: 60000, max: 1, throttleMs: 1, keyFn: (req) => `spend:ip:${req.ip}` },
				{ windowMs: 60000, max: 2, keyFn: () => "spend:day" },
			])
			expect(run(mw, "9.9.7.1").next).toHaveBeenCalled()
			expect(run(mw, "9.9.7.1", 429).next).toHaveBeenCalled()
			expect(run(mw, "9.9.7.2").res.status).toHaveBeenCalledWith(429)
			expect(run(mw, "9.9.7.3").res.status).toHaveBeenCalledWith(429)
		})

		test("is wired onto POST /setup and returns 429 once exhausted", async () => {
			let res
			for (let i = 0; i < 11; i++) {
				res = await supertest(app)
					.post("/authorization/setup")
					.set("X-Forwarded-For", "198.51.100.23")
					.send({ username: "admin", password: "correct-horse-battery", token: "wrong-token" })
			}
			expect(res.status).toBe(429)
			expect(res.body).toEqual({ error: true, errors: "TOO_MANY_ATTEMPTS" })

			const otherIp = await supertest(app)
				.post("/authorization/setup")
				.set("X-Forwarded-For", "198.51.100.24")
				.send({ username: "admin", password: "correct-horse-battery", token: "wrong-token" })
			expect(otherIp.status).toBe(403)
		})

		test("empty-body 400s do not count toward the login lockout", async () => {
			let res
			for (let i = 0; i < 15; i++) {
				res = await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", "203.0.113.7")
					.send({})
			}
			expect(res.status).toBe(400)
		})

		test("locks a single account across distinct IPs", async () => {
			let res
			for (let i = 0; i < 11; i++) {
				res = await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `198.51.100.${100 + i}`)
					.send({ username: "lockme", password: "wrongpassword" })
			}
			expect(res.status).toBe(429)
			expect(res.body).toEqual({ error: true, errors: "TOO_MANY_ATTEMPTS" })
		})

		test("a correct password still logs in after wrong attempts exhaust the per-username budget", async () => {
			for (let i = 0; i < 10; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `192.0.2.${10 + i}`)
					.send({ username: "dosvictim", password: "wrongpassword" })
			}
			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.99")
				.send({ username: "dosvictim", password: "mockedPassword" })
			expect(res.status).toBe(200)
			expect(res.body.error).toBe(false)
		})

		test("only one credential check runs per throttle window once the budget is spent", async () => {
			const now = Date.now()
			jest.spyOn(Date, "now").mockImplementation(() => now)
			for (let i = 0; i < 10; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `192.0.2.${160 + i}`)
					.send({ username: "floodvictim", password: "wrongpassword" })
			}
			const start = process.hrtime.bigint()
			const first = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.180")
				.send({ username: "floodvictim", password: "mockedPassword" })
			const second = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.181")
				.send({ username: "floodvictim", password: "mockedPassword" })
			expect(first.status).toBe(200)
			expect(second.status).toBe(429)
			expect(Number(process.hrtime.bigint() - start) / 1e6).toBeLessThan(1000)
		})

		// the throttle slot is one per username and anyone can take it, so a long window would hand an
		// attacker a permanent lockout of a user who has no device token — a new browser or a password change
		test("an attacker holding the account throttle slot costs the real user 10 seconds, not 15 minutes", async () => {
			const username = "throttlewindowvictim"
			let now = Date.now()
			jest.spyOn(Date, "now").mockImplementation(() => now)
			jest.spyOn(bcrypt, "compare").mockImplementation((pw, hash, cb) => cb(null, pw === "mockedPassword"))

			for (let i = 0; i < 10; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `192.0.2.${i}`)
					.send({ username, password: "wrongpassword" })
			}
			const attacker = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.50")
				.send({ username, password: "wrongpassword" })
			expect(attacker.status).toBe(429)

			const victim = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.51")
				.send({ username, password: "mockedPassword" })
			expect(victim.status).toBe(429)

			now += 10 * 1000 + 1
			const tenSecondsLater = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.52")
				.send({ username, password: "mockedPassword" })
			expect(tenSecondsLater.status).toBe(200)
		})

		test("a throttled request is refused immediately instead of being queued", async () => {
			for (let i = 0; i < 10; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `192.0.2.${20 + i}`)
					.send({ username: "queuevictim", password: "wrongpassword" })
			}
			const start = Date.now()
			const results = await Promise.all([0, 1, 2, 3, 4].map((i) =>
				supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `192.0.2.${60 + i}`)
					.send({ username: "queuevictim", password: "wrongpassword" })
			))
			expect(results.every((r) => r.status === 429)).toBe(true)
			expect(Date.now() - start).toBeLessThan(1000)
		})

		test("a flood against other usernames does not lock out a user sharing the egress IP", async () => {
			const shared = "198.18.0.7"
			for (let i = 0; i < 20; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", shared)
					.send({ username: `sharedtarget${i}`, password: "wrongpassword" })
			}
			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", shared)
				.send({ username: "sharedvictim", password: "mockedPassword" })
			expect(res.status).toBe(200)
		})

		// one username for the whole spray, so the per-username throttle refuses most
		// of it before passwordCheck and the loop costs ~11 bcrypt compares, not 20
		test("a spent per-IP budget throttles instead of blocking, and a device token does not skip it", async () => {
			const now = Date.now()
			jest.spyOn(Date, "now").mockImplementation(() => now)
			const ip = "198.18.3.3"
			const agent = supertest.agent(app)
			const enrol = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "198.18.9.9")
				.send({ username: "iptokenuser", password: "mockedPassword" })
			expect(enrol.status).toBe(200)

			for (let i = 0; i < 20; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", ip)
					.send({ username: `sprayfodder${i}`, password: "wrongpassword" })
			}

			const first = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "sprayvictim", password: "mockedPassword" })
			expect(first.status).toBe(200)

			const second = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "sprayvictim", password: "mockedPassword" })
			expect(second.status).toBe(429)

			const known = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "iptokenuser", password: "mockedPassword" })
			expect(known.status).toBe(429)
		}, 30000)

		test("a spent per-IP budget answers 429 on a wrong password for an untouched username", async () => {
			const ip = "198.18.5.5"
			for (let i = 0; i < 20; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", ip)
					.send({ username: `carryfodder${i}`, password: "wrongpassword" })
			}

			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "carryvictim", password: "wrongpassword" })
			expect(res.status).toBe(429)
			expect(res.body.errors).toBe("TOO_MANY_ATTEMPTS")
		}, 30000)

		// Date.now is mocked so the 15-minute burst window can renew while the daily
		// window stays open — six renewed bursts overspend the daily 100 on purpose,
		// so an assertion never lands on the exact request that empties the budget
		test("the daily per-IP ceiling holds after the burst window renews", async () => {
			const ip = "198.18.7.7"
			let now = Date.now()
			jest.spyOn(Date, "now").mockImplementation(() => now)
			jest.spyOn(bcrypt, "compare").mockImplementation((pw, hash, cb) => cb(null, pw === "mockedPassword"))
			for (let round = 0; round < 6; round++) {
				for (let i = 0; i < 20; i++) {
					await supertest(app)
						.post("/authorization/login")
						.set("X-Forwarded-For", ip)
						.send({ username: `dayfodder${round}_${i}`, password: "wrongpassword" })
				}
				now += 16 * 60 * 1000
			}
			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "dayvictim", password: "wrongpassword" })
			expect(res.status).toBe(429)
			expect(res.body.errors).toBe("TOO_MANY_ATTEMPTS")
		}, 30000)

		test("a device token skips the per-IP daily budget, so a spent day does not throttle returning users", async () => {
			const ip = "198.18.7.8"
			let now = Date.now()
			jest.spyOn(Date, "now").mockImplementation(() => now)
			jest.spyOn(bcrypt, "compare").mockImplementation((pw, hash, cb) => cb(null, pw === "mockedPassword"))

			const agent = supertest.agent(app)
			const enrol = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "198.18.7.9")
				.send({ username: "daytokenuser", password: "mockedPassword" })
			expect(enrol.status).toBe(200)

			for (let round = 0; round < 6; round++) {
				for (let i = 0; i < 20; i++) {
					await supertest(app)
						.post("/authorization/login")
						.set("X-Forwarded-For", ip)
						.send({ username: `daytokenfodder${round}_${i}`, password: "wrongpassword" })
				}
				now += 16 * 60 * 1000
			}

			const stranger = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "daytokenuser", password: "mockedPassword" })
			expect(stranger.status).toBe(200)

			const throttled = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "daytokenuser", password: "mockedPassword" })
			expect(throttled.status).toBe(429)

			const first = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "daytokenuser", password: "mockedPassword" })
			expect(first.status).toBe(200)

			const second = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", ip)
				.send({ username: "daytokenuser", password: "mockedPassword" })
			expect(second.status).toBe(200)
		}, 30000)

		test("a device token from an earlier login skips the throttle", async () => {
			const agent = supertest.agent(app)
			const enrol = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.200")
				.send({ username: "knowndevice", password: "mockedPassword" })
			expect(enrol.status).toBe(200)

			for (let i = 0; i < 10; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `192.0.2.${210 + i}`)
					.send({ username: "knowndevice", password: "wrongpassword" })
			}
			const throttled = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.230")
				.send({ username: "knowndevice", password: "wrongpassword" })
			expect(throttled.status).toBe(429)

			const known = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.231")
				.send({ username: "knowndevice", password: "mockedPassword" })
			expect(known.status).toBe(200)

			const stranger = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.232")
				.send({ username: "knowndevice", password: "mockedPassword" })
			expect(stranger.status).toBe(429)
		})

		test("a known device still has to pass the password check", async () => {
			const agent = supertest.agent(app)
			const enrol = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.117.5")
				.send({ username: "wrongpwdevice", password: "mockedPassword" })
			expect(enrol.status).toBe(200)

			for (let i = 0; i < 10; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `203.0.117.${10 + i}`)
					.send({ username: "wrongpwdevice", password: "wrongpassword" })
			}
			const stranger = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.117.90")
				.send({ username: "wrongpwdevice", password: "wrongpassword" })
			expect(stranger.status).toBe(429)

			const known = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.117.91")
				.send({ username: "wrongpwdevice", password: "wrongpassword" })
			expect(known.status).toBe(400)
			expect(known.body).toEqual({ error: true, errors: "INVALID_CREDENTIALS" })
			expect(known.headers["set-cookie"]).toBeUndefined()
		})

		test("a device token for another username does not skip the throttle", async () => {
			const now = Date.now()
			jest.spyOn(Date, "now").mockImplementation(() => now)
			const agent = supertest.agent(app)
			await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.240")
				.send({ username: "deviceowner", password: "mockedPassword" })

			for (let i = 0; i < 10; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `198.51.100.${10 + i}`)
					.send({ username: "othervictim", password: "wrongpassword" })
			}
			await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "198.51.100.40")
				.send({ username: "othervictim", password: "wrongpassword" })

			const res = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "198.51.100.41")
				.send({ username: "othervictim", password: "mockedPassword" })
			expect(res.status).toBe(429)
		})

		test("a password change voids the device token", async () => {
			const now = Date.now()
			jest.spyOn(Date, "now").mockImplementation(() => now)
			const agent = supertest.agent(app)
			const enrol = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.250")
				.send({ username: "resetdevice", password: "mockedPassword" })
			expect(enrol.status).toBe(200)

			for (let i = 0; i < 11; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `203.0.114.${10 + i}`)
					.send({ username: "resetdevice", password: "wrongpassword" })
			}

			mockedPool.query.mockResolvedValueOnce({ rows: [{ hash: bcrypt.hashSync("rotated", 10) }], rowCount: 1 })
			const res = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.114.90")
				.send({ username: "resetdevice", password: "mockedPassword" })
			expect(res.status).toBe(429)
		})

		test("a deleted account voids the device token", async () => {
			const now = Date.now()
			jest.spyOn(Date, "now").mockImplementation(() => now)
			const agent = supertest.agent(app)
			await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.116.5")
				.send({ username: "gonedevice", password: "mockedPassword" })

			for (let i = 0; i < 11; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `203.0.116.${10 + i}`)
					.send({ username: "gonedevice", password: "wrongpassword" })
			}

			mockedPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			const res = await agent
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.116.90")
				.send({ username: "gonedevice", password: "mockedPassword" })
			expect(res.status).toBe(429)
		})

		test("a device token with no password fingerprint does not skip the throttle", async () => {
			for (let i = 0; i < 11; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `203.0.115.${10 + i}`)
					.send({ username: "legacydevice", password: "wrongpassword" })
			}
			const legacy = jwt.sign({ username: "legacydevice", device: true }, process.env.SECRETKEY, { expiresIn: "365d" })
			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.115.90")
				.set("Cookie", [`devicetoken=${legacy}`])
				.send({ username: "legacydevice", password: "mockedPassword" })
			expect(res.status).toBe(429)
		})

		test("a device token with a bad signature does not skip the throttle", async () => {
			for (let i = 0; i < 11; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `203.0.118.${10 + i}`)
					.send({ username: "forgeddevice", password: "wrongpassword" })
			}
			const forged = jwt.sign({ username: "forgeddevice", device: true, dk: "anything" }, "wrong-secret", { expiresIn: "365d" })
			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.118.90")
				.set("Cookie", [`devicetoken=${forged}`])
				.send({ username: "forgeddevice", password: "mockedPassword" })
			expect(res.status).toBe(429)
		})

		test("a correctly signed non-device token does not skip the throttle", async () => {
			for (let i = 0; i < 11; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `203.0.119.${10 + i}`)
					.send({ username: "notadevice", password: "wrongpassword" })
			}
			const notDevice = jwt.sign({ username: "notadevice", role: "user", jti: "jti-notdevice" }, process.env.SECRETKEY, { expiresIn: "365d" })
			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "203.0.119.90")
				.set("Cookie", [`devicetoken=${notDevice}`])
				.send({ username: "notadevice", password: "mockedPassword" })
			expect(res.status).toBe(429)
		})

		test("a successful login refunds its slot, so correct logins never spend the per-username budget", async () => {
			let res
			for (let i = 0; i < 12; i++) {
				res = await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `203.0.117.${10 + i}`)
					.send({ username: "refundcredit", password: "mockedPassword" })
			}
			expect(res.status).toBe(200)
		})

		test("a successful login does not refund a guess to an exhausted per-username budget", async () => {
			for (let i = 0; i < 10; i++) {
				await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", `192.0.2.${110 + i}`)
					.send({ username: "refundvictim", password: "wrongpassword" })
			}
			await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.150")
				.send({ username: "refundvictim", password: "mockedPassword" })
			const res = await supertest(app)
				.post("/authorization/login")
				.set("X-Forwarded-For", "192.0.2.151")
				.send({ username: "refundvictim", password: "wrongpassword" })
			expect(res.status).toBe(429)
		})
	})

	describe("rateLimit (shared memory instance)", () => {
		let rateLimit
		beforeAll(() => {
			process.env.memory_ON = "true"
			jest.isolateModules(() => {
				rateLimit = require("../backend/routes/authorization.js").rateLimit
			})
		})
		afterAll(() => {
			delete process.env.memory_ON
		})

		const run = (mw, ip, statusCode = 400) => {
			const req = { headers: {}, ip, path: "/login" }
			let onFinish
			const res = {
				statusCode,
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
				on: (event, fn) => { if (event === "finish") onFinish = fn }
			}
			const next = jest.fn(() => onFinish && onFinish())
			mw(req, res, next)
			return { res, next }
		}

		test("blocks after max failures via the shared store", () => {
			const mw = rateLimit({ windowMs: 60000, max: 2 })
			expect(run(mw, "9.9.9.9").next).toHaveBeenCalled()
			expect(run(mw, "9.9.9.9").next).toHaveBeenCalled()
			const { res, next } = run(mw, "9.9.9.9")
			expect(next).not.toHaveBeenCalled()
			expect(res.status).toHaveBeenCalledWith(429)
		})

		test("shares failures across separate limiter instances", () => {
			const a = rateLimit({ windowMs: 60000, max: 1 })
			const b = rateLimit({ windowMs: 60000, max: 1 })
			run(a, "8.8.8.8")
			expect(run(b, "8.8.8.8").res.status).toHaveBeenCalledWith(429)
		})

		test("falls back to a local limiter when the shared client is disconnected", () => {
			let limiter
			jest.isolateModules(() => {
				jest.doMock("memory", () => ({
					client: () => ({
						connected: false,
						timeout() { return this },
						emit: jest.fn(),
						on: () => {}
					}),
					loginAttempts: require("../../memory/lib/loginAttempts.js")
				}))
				limiter = require("../backend/routes/authorization.js").rateLimit
			})
			const mw = limiter({ windowMs: 60000, max: 1 })
			expect(run(mw, "6.6.6.6").next).toHaveBeenCalled()
			expect(run(mw, "6.6.6.6").res.status).toHaveBeenCalledWith(429)
		})

		test("falls back to a local limiter when the shared store ack errors or times out", () => {
			let limiter
			jest.isolateModules(() => {
				jest.doMock("memory", () => ({
					client: () => ({
						connected: true,
						timeout() { return this },
						emit: (event, ...args) => {
							const ack = args[args.length - 1]
							if (typeof ack === "function") ack(new Error("operation has timed out"))
						},
						on: () => {}
					}),
					loginAttempts: require("../../memory/lib/loginAttempts.js")
				}))
				limiter = require("../backend/routes/authorization.js").rateLimit
			})
			const mw = limiter({ windowMs: 60000, max: 1 })
			expect(run(mw, "7.7.7.7").next).toHaveBeenCalled()
			expect(run(mw, "7.7.7.7").res.status).toHaveBeenCalledWith(429)
		})
	})

	describe("forced password change (wired via Express routing)", () => {
		const token = jwt.sign({ username: "bob", role: "user", jti: "fpc-1" }, "test-secret")

		test("blocks a non-allowlisted route with 401", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "user", force_password_change: true, revoked: false }], rowCount: 1 })
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "x", role: "user" })
			expect(res.status).toBe(401)
		})

		test("allows the password-change route through", async () => {
			mockedPool.query
				.mockResolvedValueOnce({ rows: [{ role: "user", force_password_change: true, revoked: false }], rowCount: 1 }) // authorize lookup
				.mockResolvedValueOnce({}) // BEGIN
				.mockResolvedValueOnce({ rows: [{ hash: "irrelevant", force_password_change: true }], rowCount: 1 }) // SELECT current
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "replacement-passphrase" })
			expect(res.status).toBe(200)
		})
	})
})
