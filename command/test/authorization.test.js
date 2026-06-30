process.env.SECRETKEY = "test-secret"

jest.mock("pg")
jest.mock("pm2")
jest.mock("axios")
jest.mock("memory")

const supertest = require("supertest")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const app = require("../backend/command.js")

const { mockedPool } = require("pg")

describe("Authorization Routes", () => {
	beforeEach(() => {
		delete process.env.setup_TOKEN
	})

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
			expect(res.body).toEqual({ setup: true, tokenRequired: false })
		})
	})

	describe("POST /authorization/setup", () => {
		test("returns 200 on first-time setup", async () => {
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "password123" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("returns 403 when table already has a row", async () => {
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 0 }) // INSERT
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "password123" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: true })
		})

		test("allows admin recovery with a valid setup_TOKEN when no admin exists", async () => {
			process.env.setup_TOKEN = "recovery-token"
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 1 }) // upsert
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "newadmin", password: "password123", token: "recovery-token" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("resets the password of an existing admin with a valid setup_TOKEN", async () => {
			process.env.setup_TOKEN = "recovery-token"
			mockedPool.query.mockResolvedValueOnce({}) // BEGIN
			mockedPool.query.mockResolvedValueOnce({}) // pg_advisory_xact_lock
			mockedPool.query.mockResolvedValueOnce({ rowCount: 1 }) // upsert (ON CONFLICT)
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "existingadmin", password: "newpassword123", token: "recovery-token" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE username = $1", ["existingadmin"])
		})

		test("rejects setup with an invalid setup_TOKEN", async () => {
			process.env.setup_TOKEN = "right-token"
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "password123", token: "wrong-token" })
			expect(res.status).toBe(403)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 400 when username or password is missing", async () => {
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin" })
			expect(res.status).toBe(400)
			expect(res.body.error).toBe(true)
		})

		test("returns 400 for username containing slash", async () => {
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "bad/admin", password: "password123" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "Username must be 3-50 characters and contain only letters, numbers, dashes, dots, and underscores." })
		})

		test("returns 400 for a password shorter than 8 characters", async () => {
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "short" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "Password must be at least 8 characters." })
		})

		test("returns 500 when the transaction throws a generic error", async () => {
			const errSpy = jest.spyOn(console, "error").mockImplementation(() => {})
			mockedPool.query.mockRejectedValueOnce(new Error("db down"))
			const res = await supertest(app)
				.post("/authorization/setup")
				.send({ username: "admin", password: "password123" })
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
			expect(errSpy).toHaveBeenCalled()
			errSpy.mockRestore()
		})
	})

	describe("POST /authorization/login", () => {
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
			expect(res.body).toEqual({ error: false, role: "user", theme: "system" })
			expect(res.headers["set-cookie"]).toBeDefined()
			expect(res.headers["set-cookie"][0]).toMatch(/^bearertoken=/)
		})

		test("rejects login when a forced temp password has expired", async () => {
			const hash = bcrypt.hashSync("temppass123", 10)
			mockedPool.query.mockImplementationOnce((str, params, cb) => {
				const result = { rows: [{ hash, role: "user", force_password_change: true, temp_password_expires: new Date(Date.now() - 60000) }], rowCount: 1 }
				cb(null, result)
				return Promise.resolve(result)
			})
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: "bob", password: "temppass123" })
			expect(res.status).toBe(400)
		})

		test("allows login when a forced temp password has not expired", async () => {
			const hash = bcrypt.hashSync("temppass123", 10)
			mockedPool.query.mockImplementationOnce((str, params, cb) => {
				const result = { rows: [{ hash, role: "user", force_password_change: true, temp_password_expires: new Date(Date.now() + 3600000) }], rowCount: 1 }
				cb(null, result)
				return Promise.resolve(result)
			})
			const res = await supertest(app)
				.post("/authorization/login")
				.send({ username: "bob", password: "temppass123" })
			expect(res.status).toBe(200)
			expect(res.body.error).toBe(false)
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
			expect(res.body).toEqual({ error: false, role: "user", forcePasswordChange: false, theme: "system" })
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

	describe("GET /authorization/users", () => {
		test("redirects to login with no token", async () => {
			const res = await supertest(app).get("/authorization/users")
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
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "admin" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE username = $1 AND jti IS DISTINCT FROM $2", ["bob", "jti-admin"])
		})

		test("returns 200 when updating password", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "newpassword" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE username = $1 AND jti IS DISTINCT FROM $2", ["bob", "jti-admin"])
		})

		test("returns 400 for a password shorter than 8 characters", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin", revoked: false }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.patch("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "short" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "Password must be at least 8 characters." })
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
			expect(res.body).toEqual({ error: true, errors: "cannot demote last admin" })
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
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
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
			expect(res.body).toEqual({ error: true, errors: "cannot delete last admin" })
		})
	})

	describe("GET /authorization/users/:username/sessions", () => {
		test("redirects to login with no token", async () => {
			const res = await supertest(app).get("/authorization/users/bob/sessions")
			expect(res.status).toBe(303)
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
			mockedPool.query.mockResolvedValueOnce({ rows: [{ id: 5 }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin", jti: "jti-admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/sessions/5")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})
	})

	describe("POST /authorization/password", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/authorization/password").send({ password: "newpassword" })
			expect(res.status).toBe(401)
		})

		test("returns 400 for a password shorter than 8 characters", async () => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "short" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "Password must be at least 8 characters." })
		})

		test("returns 200 and clears the temp-password expiry on success", async () => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "jti-user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "newpassword" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith(
				"UPDATE auth SET hash = $1, force_password_change = FALSE, temp_password_expires = NULL WHERE username = $2",
				expect.arrayContaining(["bob"])
			)
			expect(mockedPool.query).toHaveBeenCalledWith(
				"UPDATE sessions SET revoked = TRUE WHERE username = $1 AND jti IS DISTINCT FROM $2",
				["bob", "jti-user"]
			)
		})
	})

	describe("POST /authorization/logout", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/authorization/logout")
			expect(res.status).toBe(401)
		})

		test("revokes the session jti and clears the cookie", async () => {
			const token = jwt.sign({ username: "bob", role: "user", jti: "sess-1" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/logout")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockedPool.query).toHaveBeenCalledWith("UPDATE sessions SET revoked = TRUE WHERE jti = $1", ["sess-1"])
			expect(res.headers["set-cookie"][0]).toMatch(/^bearertoken=;/)
		})
	})

	describe("rateLimit", () => {
		const { rateLimit } = require("../backend/routes/authorization.js")

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

		test("is wired onto POST /login and returns 429 once exhausted", async () => {
			let res
			for (let i = 0; i < 11; i++) {
				res = await supertest(app)
					.post("/authorization/login")
					.set("X-Forwarded-For", "198.51.100.23")
					.send({ username: "admin", password: "wrongpassword" })
			}
			expect(res.status).toBe(429)
			expect(res.body).toEqual({ error: true, errors: "Too many attempts" })
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
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "user", force_password_change: true, revoked: false }], rowCount: 1 })
			const res = await supertest(app)
				.post("/authorization/password")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "newpassword" })
			expect(res.status).toBe(200)
		})
	})
})
