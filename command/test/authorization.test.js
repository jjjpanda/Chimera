const supertest = require("supertest")
const app = require("../backend/command.js")

const mockedUsername = "admin"
const mockedPassword = "mockedPassword"

jest.mock("pg")
jest.mock("pm2")
jest.mock("axios")
jest.mock("memory")

describe("Authorization Routes", () => {
	describe("/authorization/status", () => {
		test("Returns setup status", (done) => {
			supertest(app)
				.get("/authorization/status")
				.expect(200, done)
		})
	})

	describe("/authorization/setup", () => {
		test("No body → 400", (done) => {
			supertest(app)
				.post("/authorization/setup")
				.expect(400, { error: true, msg: "no body" }, done)
		})

		test("Missing fields → 400", (done) => {
			supertest(app)
				.post("/authorization/setup")
				.send({ username: mockedUsername })
				.expect(400, done)
		})

		test("Valid credentials on empty table → 200", (done) => {
			supertest(app)
				.post("/authorization/setup")
				.send({ username: mockedUsername, password: mockedPassword })
				.expect(200, { error: false }, done)
		})

		test("Already configured → 403", (done) => {
			const { mockedPool } = require("pg")
			jest.spyOn(mockedPool, "query").mockResolvedValueOnce({ rows: [{ count: "1" }] })
			supertest(app)
				.post("/authorization/setup")
				.send({ username: mockedUsername, password: mockedPassword })
				.expect(403, (err) => {
					jest.restoreAllMocks()
					done(err)
				})
		})

		test("Concurrent setup (unique constraint) → 403", (done) => {
			const { mockedPool } = require("pg")
			jest.spyOn(mockedPool, "query")
				.mockResolvedValueOnce({ rows: [{ count: "0" }] })
				.mockRejectedValueOnce({ code: "23505" })
			supertest(app)
				.post("/authorization/setup")
				.send({ username: mockedUsername, password: mockedPassword })
				.expect(403, (err) => {
					jest.restoreAllMocks()
					done(err)
				})
		})
	})

	describe("/authorization/login", () => {
		test("Login with incorrect password", (done) => {
			supertest(app)
				.post("/authorization/login")
				.send({username: mockedUsername, password: "incorrectPassword"})
				.expect(400, done)
		})

		test("Login with correct password", (done) => {
			supertest(app)
				.post("/authorization/login")
				.send({username: mockedUsername, password: mockedPassword})
				.expect(200)
				.expect("set-cookie", /bearertoken=Bearer%20.*; Max-Age=.*/, done)
		})

		test("Login with no body", (done) => {
			supertest(app)
				.post("/authorization/login")
				.expect(400, { error: true, msg: "no body" }, done)
		})
	})

	describe("/authorization/verify", () => {
		test("Login with correct password and verify", (done) => {
			supertest(app)
				.post("/authorization/login")
				.send({username: mockedUsername, password: mockedPassword})
				.expect(200)
				.expect("set-cookie", /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
					let cookieWithBearerToken = res.headers["set-cookie"]
					supertest(app)
						.post("/authorization/verify")
						.set("Cookie", cookieWithBearerToken)
						.expect(200, done)
				})
		})

		test("Verify with wrong bearer token", (done) => {
			supertest(app)
				.post("/authorization/verify")
				.set("Cookie", "veryWrongBearerToken")
				.expect(401, done)
		})
	})
})
