process.env.SECRETKEY = "test-secret"

jest.mock("pg")
jest.mock("pm2")
jest.mock("axios")
jest.mock("memory")

const supertest = require("supertest")
const jwt = require("jsonwebtoken")
const app = require("../backend/command.js")

const { mockedPool } = require("pg")

describe("Authorization Routes", () => {
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
			expect(res.body).toEqual({ error: true })
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
			expect(res.body).toEqual({ error: false, role: "user" })
			expect(res.headers["set-cookie"]).toBeDefined()
			expect(res.headers["set-cookie"][0]).toMatch(/^bearertoken=/)
		})
	})

	describe("POST /authorization/verify", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/authorization/verify")
			expect(res.status).toBe(401)
		})

		test("returns 200 with valid bearertoken", async () => {
			const token = jwt.sign({ username: "test", role: "user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/verify")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false, role: "user" })
		})

		test("returns 401 for valid JWT of deleted user", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			const token = jwt.sign({ username: "deleted", role: "user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/verify")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(401)
			expect(res.body).toEqual({ error: "unauthorized" })
		})
	})

	describe("GET /authorization/users", () => {
		test("redirects to login with no token", async () => {
			const res = await supertest(app).get("/authorization/users")
			expect(res.status).toBe(303)
		})

		test("returns 403 for non-admin token", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "user" }], rowCount: 1 })
			const token = jwt.sign({ username: "test", role: "user" }, "test-secret")
			const res = await supertest(app)
				.get("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(403)
		})

		test("returns 200 with user list for admin", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ username: "admin", role: "admin" }] })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
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
			const token = jwt.sign({ username: "test", role: "user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(403)
		})

		test("returns 400 for missing fields", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob" })
			expect(res.status).toBe(400)
		})

		test("returns 400 for invalid role", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "superuser" })
			expect(res.status).toBe(400)
		})

		test("returns 400 for username containing slash", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bad/user", password: "pass", role: "user" })
			expect(res.status).toBe(400)
		})

		test("returns 200 on successful user creation", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("returns 400 for duplicate username", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockRejectedValueOnce({ code: "23505" })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 500 for non-duplicate db error", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockRejectedValueOnce({ code: "08006" })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ username: "bob", password: "pass", role: "user" })
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})
	})

	describe("POST /authorization/users/update/:username", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/authorization/users/update/bob").send({ role: "admin" })
			expect(res.status).toBe(401)
		})

		test("returns 403 for non-admin token", async () => {
			const token = jwt.sign({ username: "test", role: "user" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users/update/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "admin" })
			expect(res.status).toBe(403)
		})

		test("returns 400 when no role or password provided", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users/update/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ foo: true })
			expect(res.status).toBe(400)
		})

		test("returns 400 for invalid role", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users/update/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "superuser" })
			expect(res.status).toBe(400)
		})

		test("returns 404 when user does not exist", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users/update/nobody")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "admin" })
			expect(res.status).toBe(404)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 200 when updating role", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users/update/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ role: "admin" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("returns 200 when updating password", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users/update/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
				.send({ password: "newpass" })
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("returns 400 when demoting last admin", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ username: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/users/update/other")
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
			const token = jwt.sign({ username: "test", role: "user" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(403)
		})

		test("returns 400 when deleting own account", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/admin")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(400)
		})

		test("returns 200 on successful deletion", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/bob")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("returns 404 when user does not exist", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/nobody")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(404)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 200 when deleting admin with multiple admins", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ username: "admin" }, { username: "other" }], rowCount: 2 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/other")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("returns 400 when deleting last admin", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({})
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "admin" }], rowCount: 1 })
			mockedPool.query.mockResolvedValueOnce({ rows: [{ username: "admin" }], rowCount: 1 })
			const token = jwt.sign({ username: "admin", role: "admin" }, "test-secret")
			const res = await supertest(app)
				.delete("/authorization/users/other")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: true, errors: "cannot delete last admin" })
		})
	})
})
