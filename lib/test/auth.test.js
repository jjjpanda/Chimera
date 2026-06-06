process.env.scheduler_AUTH = "scheduler-secret"
process.env.SECRETKEY = "test-secret"

const jwt = require("jsonwebtoken")
const { createAuthorize, requireAdmin, schedulableUrls } = require("../utils/auth.js")

const makeRes = () => ({
	redirect: jest.fn(),
	status: jest.fn().mockReturnThis(),
	send: jest.fn(),
	json: jest.fn()
})

describe("makeAuthorize scheduler path", () => {
	const authorize = createAuthorize(null)

	test("scheduler token on a schedulable url authorizes as admin", () => {
		const req = { method: "POST", path: schedulableUrls[0], headers: { authorization: process.env.scheduler_AUTH } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		expect(next).toHaveBeenCalled()
		expect(req.decoded).toEqual({ username: "scheduler", role: "admin" })
	})

	test("scheduler-authorized request passes requireAdmin", () => {
		const req = { method: "POST", path: schedulableUrls[0], headers: { authorization: process.env.scheduler_AUTH } }
		const res = makeRes()
		authorize(req, res, jest.fn())
		const adminNext = jest.fn()
		requireAdmin(req, res, adminNext)
		expect(adminNext).toHaveBeenCalled()
		expect(res.status).not.toHaveBeenCalled()
	})

	test("scheduler token on a non-schedulable url is rejected", () => {
		const req = { method: "POST", path: "/convert/notAllowed", headers: { authorization: process.env.scheduler_AUTH } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		expect(next).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(401)
	})

	test("wrong authorization value is rejected", () => {
		const req = { method: "POST", path: schedulableUrls[0], headers: { authorization: "wrong" } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		expect(next).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(401)
	})
})

describe("makeAuthorize jwt pool path", () => {
	const token = jwt.sign({ username: "bob" }, process.env.SECRETKEY)

	test("responds 500 when pool.query rejects", async () => {
		const pool = { query: jest.fn().mockRejectedValue(new Error("db down")) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledWith("SELECT role FROM auth WHERE username = $1", ["bob"])
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.send).toHaveBeenCalledWith({ error: "server error" })
		expect(next).not.toHaveBeenCalled()
	})
})
