process.env.scheduler_AUTH = "scheduler-secret"
process.env.SECRETKEY = "test-secret"

const jwt = require("jsonwebtoken")
const { createAuthorize, requireAdmin, invalidateSession, invalidateUser, invalidateAllSessions, connectSessionSync } = require("../utils/auth.js")
const schedulableUrls = require("../utils/schedulableUrls.js")
const forcedChangeAllowed = ["/authorization/password", "/authorization/verify", "/authorization/logout"]

const makeRes = () => ({
	redirect: jest.fn(),
	status: jest.fn().mockReturnThis(),
	send: jest.fn(),
	json: jest.fn()
})

beforeEach(() => invalidateAllSessions())

describe("makeAuthorize scheduler path", () => {
	const authorize = createAuthorize(null, { schedulableUrls })

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

	test("a blank scheduler_AUTH does not let an empty authorization header bypass auth", () => {
		const original = process.env.scheduler_AUTH
		process.env.scheduler_AUTH = ""
		const req = { method: "POST", path: schedulableUrls[0], headers: { authorization: "" }, cookies: {} }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		process.env.scheduler_AUTH = original
		expect(next).not.toHaveBeenCalled()
		expect(req.decoded).toBeUndefined()
		expect(res.status).toHaveBeenCalledWith(401)
	})
})

describe("unauthorized response shape", () => {
	const authorize = createAuthorize(null)
	const run = (headers) => {
		const req = { method: "GET", path: "/x", headers, cookies: {} }
		const res = makeRes()
		authorize(req, res, jest.fn())
		return res
	}

	test("GET XHR without navigation headers returns 401", () => {
		const res = run({})
		expect(res.status).toHaveBeenCalledWith(401)
		expect(res.redirect).not.toHaveBeenCalled()
	})

	test("GET browser navigation redirects to the login form", () => {
		const res = run({ "sec-fetch-mode": "navigate" })
		expect(res.redirect).toHaveBeenCalledWith(303, "/?loginForm")
	})

	test("GET document request (text/html accept, no sec-fetch-mode) redirects", () => {
		const res = run({ accept: "text/html,application/xhtml+xml" })
		expect(res.redirect).toHaveBeenCalledWith(303, "/?loginForm")
	})

	test("GET fetch (sec-fetch-mode cors) returns 401 even with an html accept header", () => {
		const res = run({ "sec-fetch-mode": "cors", accept: "text/html" })
		expect(res.status).toHaveBeenCalledWith(401)
		expect(res.redirect).not.toHaveBeenCalled()
	})
})

describe("makeAuthorize jwt pool path", () => {
	test("rejects a token without a jti", async () => {
		const token = jwt.sign({ username: "bob" }, process.env.SECRETKEY)
		const pool = { query: jest.fn() }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(401)
		expect(next).not.toHaveBeenCalled()
	})

	test("responds 500 when pool.query rejects", async () => {
		const token = jwt.sign({ username: "bob", jti: "sess-1" }, process.env.SECRETKEY)
		const pool = { query: jest.fn().mockRejectedValue(new Error("db down")) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.send).toHaveBeenCalledWith({ error: "server error" })
		expect(next).not.toHaveBeenCalled()
	})

	test("redirects a GET navigation to the login form when pool.query rejects", async () => {
		const token = jwt.sign({ username: "bob", jti: "sess-1" }, process.env.SECRETKEY)
		const pool = { query: jest.fn().mockRejectedValue(new Error("db down")) }
		const authorize = createAuthorize(pool)
		const req = { method: "GET", path: "/x", headers: { "sec-fetch-mode": "navigate" }, cookies: { bearertoken: `Bearer ${token}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(res.redirect).toHaveBeenCalledWith(303, "/?loginForm")
		expect(res.status).not.toHaveBeenCalledWith(500)
		expect(next).not.toHaveBeenCalled()
	})
})

describe("makeAuthorize jwt session revocation", () => {
	const tokenWithJti = jwt.sign({ username: "bob", jti: "sess-1" }, process.env.SECRETKEY)

	test("valid active session calls next and bumps last_seen if older than 5 minutes", async () => {
		const pool = { query: jest.fn().mockResolvedValue({ rows: [{ role: "user", revoked: false, last_seen: new Date(Date.now() - 10 * 60 * 1000) }], rowCount: 1 }) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${tokenWithJti}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE sessions SET last_seen = NOW()"), ["sess-1"])
		expect(req.decoded.role).toBe("user")
		expect(next).toHaveBeenCalled()
	})

	test("valid active session calls next and does not bump last_seen if recent", async () => {
		const pool = { query: jest.fn().mockResolvedValue({ rows: [{ role: "user", revoked: false, last_seen: new Date() }], rowCount: 1 }) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${tokenWithJti}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE sessions SET last_seen = NOW()"), expect.anything())
		expect(req.decoded.role).toBe("user")
		expect(next).toHaveBeenCalled()
	})

	test("revoked session is unauthorized", async () => {
		const pool = { query: jest.fn().mockResolvedValue({ rows: [{ role: "user", revoked: null }], rowCount: 1 }) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${tokenWithJti}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(res.status).toHaveBeenCalledWith(401)
		expect(res.send).toHaveBeenCalledWith({ error: "unauthorized" })
		expect(next).not.toHaveBeenCalled()
	})

	test("missing session row is unauthorized", async () => {
		const pool = { query: jest.fn().mockResolvedValue({ rows: [{ role: "user", revoked: null }], rowCount: 1 }) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${tokenWithJti}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(res.status).toHaveBeenCalledWith(401)
		expect(next).not.toHaveBeenCalled()
	})

	test("unknown user is unauthorized", async () => {
		const pool = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${tokenWithJti}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(res.status).toHaveBeenCalledWith(401)
		expect(next).not.toHaveBeenCalled()
	})
})

describe("makeAuthorize session cache", () => {
	const token = jwt.sign({ username: "bob", jti: "cache-jti" }, process.env.SECRETKEY)
	const activeRow = { rows: [{ role: "user", revoked: false, last_seen: new Date() }], rowCount: 1 }

	test("does not re-query the database within the cache window", async () => {
		const pool = { query: jest.fn().mockResolvedValue(activeRow) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(1)
	})

	test("invalidateSession forces a fresh lookup that reflects revocation", async () => {
		const pool = { query: jest.fn().mockResolvedValue(activeRow) }
		const authorize = createAuthorize(pool)
		const req1 = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		const next1 = jest.fn()
		authorize(req1, makeRes(), next1)
		await new Promise(resolve => setImmediate(resolve))
		expect(next1).toHaveBeenCalled()

		invalidateSession("cache-jti")
		pool.query.mockResolvedValueOnce({ rows: [{ role: "user", revoked: true }], rowCount: 1 })
		const req2 = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		const res2 = makeRes()
		const next2 = jest.fn()
		authorize(req2, res2, next2)
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(2)
		expect(next2).not.toHaveBeenCalled()
		expect(res2.status).toHaveBeenCalledWith(401)
	})

	test("invalidateAllSessions clears every cached entry for the pool", async () => {
		const pool = { query: jest.fn().mockResolvedValue(activeRow) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		invalidateAllSessions()
		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(2)
	})

	test("invalidateUser evicts only the target user's cached entries", async () => {
		const aliceToken = jwt.sign({ username: "alice", jti: "alice-jti" }, process.env.SECRETKEY)
		const pool = { query: jest.fn().mockResolvedValue(activeRow) }
		const authorize = createAuthorize(pool)
		const bobReq = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		const aliceReq = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${aliceToken}` } }
		authorize(bobReq, makeRes(), jest.fn())
		authorize(aliceReq, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(2)

		invalidateUser("bob")

		authorize(bobReq, makeRes(), jest.fn())
		authorize(aliceReq, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(3)
	})

	test("an invalidation during an in-flight lookup is not resurrected by the stale read", async () => {
		let resolveInflight
		const pool = { query: jest.fn()
			.mockImplementationOnce(() => new Promise(resolve => { resolveInflight = () => resolve(activeRow) }))
			.mockResolvedValue({ rows: [{ role: "user", revoked: true }], rowCount: 1 })
		}
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		invalidateSession("cache-jti")
		resolveInflight()
		await new Promise(resolve => setImmediate(resolve))
		const res2 = makeRes()
		const next2 = jest.fn()
		authorize(req, res2, next2)
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(2)
		expect(next2).not.toHaveBeenCalled()
		expect(res2.status).toHaveBeenCalledWith(401)
	})

})

describe("makeAuthorize cross-process session invalidation", () => {
	const token = jwt.sign({ username: "bob", jti: "cache-jti" }, process.env.SECRETKEY)
	const activeRow = { rows: [{ role: "user", revoked: false, last_seen: new Date() }], rowCount: 1 }

	afterEach(() => connectSessionSync(null))

	test("a broadcast from a sibling worker clears this worker's cache", async () => {
		const handlers = {}
		const bus = {
			emit: (event, jti) => (handlers[event] || []).forEach(h => h(jti)),
			on: (event, handler) => (handlers[event] = handlers[event] || []).push(handler)
		}
		connectSessionSync(bus)

		const pool = { query: jest.fn().mockResolvedValue(activeRow) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }

		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(1)

		bus.emit("sessionInvalidate", "cache-jti")
		pool.query.mockResolvedValueOnce({ rows: [{ role: "user", revoked: true }], rowCount: 1 })
		const res2 = makeRes()
		const next2 = jest.fn()
		authorize(req, res2, next2)
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(2)
		expect(next2).not.toHaveBeenCalled()
		expect(res2.status).toHaveBeenCalledWith(401)
	})

	test("a sessionInvalidateAll broadcast clears this worker's cache", async () => {
		const handlers = {}
		const bus = {
			emit: (event, jti) => (handlers[event] || []).forEach(h => h(jti)),
			on: (event, handler) => (handlers[event] = handlers[event] || []).push(handler)
		}
		connectSessionSync(bus)

		const pool = { query: jest.fn().mockResolvedValue(activeRow) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }

		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		bus.emit("sessionInvalidateAll")
		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(2)
	})

	test("invalidateSession broadcasts the jti to sibling workers", () => {
		const events = []
		connectSessionSync({ emit: (event, jti) => events.push([event, jti]), on: () => {} })
		invalidateSession("sess-9")
		expect(events).toContainEqual(["sessionInvalidate", "sess-9"])
	})

	test("invalidateAllSessions broadcasts to sibling workers", () => {
		const events = []
		connectSessionSync({ emit: (event) => events.push(event), on: () => {} })
		invalidateAllSessions()
		expect(events).toContain("sessionInvalidateAll")
	})

	test("invalidateUser broadcasts the username to sibling workers", () => {
		const events = []
		connectSessionSync({ emit: (event, arg) => events.push([event, arg]), on: () => {} })
		invalidateUser("bob")
		expect(events).toContainEqual(["sessionInvalidateUser", "bob"])
	})

	test("a sessionInvalidateUser broadcast clears this worker's cache", async () => {
		const handlers = {}
		const bus = {
			emit: (event, arg) => (handlers[event] || []).forEach(h => h(arg)),
			on: (event, handler) => (handlers[event] = handlers[event] || []).push(handler)
		}
		connectSessionSync(bus)

		const pool = { query: jest.fn().mockResolvedValue(activeRow) }
		const authorize = createAuthorize(pool)
		const req = { method: "POST", path: "/x", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }

		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		bus.emit("sessionInvalidateUser", "bob")
		authorize(req, makeRes(), jest.fn())
		await new Promise(resolve => setImmediate(resolve))
		expect(pool.query).toHaveBeenCalledTimes(2)
	})

	test("does not broadcast when no memory client is connected", () => {
		connectSessionSync(null)
		expect(() => { invalidateSession("x"); invalidateAllSessions() }).not.toThrow()
	})
})

describe("makeAuthorize forced password change", () => {
	const token = jwt.sign({ username: "bob", jti: "s1" }, process.env.SECRETKEY)
	const forcedPool = () => ({ query: jest.fn().mockResolvedValue({ rows: [{ role: "user", force_password_change: true, revoked: false }], rowCount: 1 }) })

	test("blocks a non-allowlisted route", async () => {
		const authorize = createAuthorize(forcedPool(), { forcedChangeAllowed })
		const req = { method: "POST", originalUrl: "/cameras", path: "/cameras", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(res.status).toHaveBeenCalledWith(401)
		expect(next).not.toHaveBeenCalled()
	})

	test("allows the password-change route", async () => {
		const authorize = createAuthorize(forcedPool(), { forcedChangeAllowed })
		const req = { method: "POST", originalUrl: "/authorization/password", path: "/password", headers: {}, cookies: { bearertoken: `Bearer ${token}` } }
		const res = makeRes()
		const next = jest.fn()
		authorize(req, res, next)
		await new Promise(resolve => setImmediate(resolve))
		expect(next).toHaveBeenCalled()
	})
})
