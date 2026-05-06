process.env.SECRETKEY = "test-secret"

const supertest = require("supertest")
const jwt = require("jsonwebtoken")
const app = require("../backend/command.js")

jest.mock("pg")
jest.mock("pm2")
jest.mock("axios")
jest.mock("memory")

const { mockedPool } = require("pg")

describe("Authorization Routes", () => {
	describe("GET /authorization/status", () => {
		test("returns setup: false when table is empty", async () => {
			const res = await supertest(app).get("/authorization/status")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ setup: false })
		})

		test("returns setup: true when table has rows", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ count: "1" }] })
			const res = await supertest(app).get("/authorization/status")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ setup: true })
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
			const clientQuery = jest.fn(str => {
				if (str.includes("COUNT")) return Promise.resolve({ rows: [{ count: "1" }] })
				return Promise.resolve({ rows: [] })
			})
			mockedPool.connect.mockResolvedValueOnce({ query: clientQuery, release: jest.fn() })
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
			expect(res.body).toEqual({ error: false })
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
			const token = jwt.sign({ username: "test" }, "test-secret")
			const res = await supertest(app)
				.post("/authorization/verify")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})
	})
})
