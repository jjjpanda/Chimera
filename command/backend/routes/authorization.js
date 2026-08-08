var express = require("express")
var { validateBody, auth, password, timingSafeCompare, rateLimiter } = require("lib")
const { requireAdmin, isCrossSite } = auth
const { passwordCheck, login, pool, withTransaction, HttpError, COOKIE_SECURE, knownDevice } = require("./lib/auth.js")
const forcedChangeAllowed = ["/authorization/password", "/authorization/verify", "/authorization/logout"]
const authorize = auth.createAuthorize(pool, { forcedChangeAllowed })
const blockCrossSite = (req, res, next) => (isCrossSite(req) ? res.status(403).send({ error: "forbidden" }) : next())

const bcrypt = require("bcryptjs")
const { randomBytes } = require("crypto")

const app = express.Router()

const { minLength: MIN_PASSWORD_LENGTH } = password
const isValidPassword = (p) => typeof p === "string" && p.length >= MIN_PASSWORD_LENGTH

const sendError = (res, e) => {
	if (e instanceof HttpError) return res.status(e.status).json({ error: true, ...(e.errors && { errors: e.errors }) })
	console.error(e)
	res.status(500).json({ error: true })
}

const hashPassword = async (pw) => bcrypt.hash(pw, await bcrypt.genSalt(10))

const getUserOr404 = async (client, username) => {
	const target = await client.query("SELECT role FROM auth WHERE username = $1", [username])
	if (target.rowCount === 0) throw new HttpError(404)
	return target.rows[0]
}

const assertNotLastAdmin = async (client, message) => {
	const admins = await client.query("SELECT username FROM auth WHERE role = 'admin' FOR UPDATE")
	if (admins.rows.length <= 1) throw new HttpError(400, message)
}

const { makeReserve, rateLimit: baseRateLimit, releaseOnSuccess, client: memoryClient } = rateLimiter("AUTH")
if (memoryClient) auth.connectSessionSync(memoryClient)

const rateLimit = (opts) => baseRateLimit({ ...opts, releaseOnSuccess: true })

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })

const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyFn: (req) => `password:${req.decoded?.username ?? ""}` })

const THROTTLE_WINDOW_MS = 10000

const accountKeyFn = (req) => `user:${typeof req.body?.username === "string" ? req.body.username : ""}`
const ipKeyFn = (req) => `ip:${req.ip || ""}`

const throttledLimiter = ({ windowMs = 15 * 60 * 1000, max, throttleMs = THROTTLE_WINDOW_MS, keyFn, skip }) => {
	const budget = makeReserve({ windowMs, max, keyFn })
	const throttle = makeReserve({ windowMs: throttleMs, max: 1, keyFn: (req) => `throttle:${keyFn(req)}` })
	const gate = (req, res, next) => budget(req, (blocked, release) => {
		req.accountThrottled ||= blocked
		if (!blocked) {
			releaseOnSuccess(res, release)
			return next()
		}
		throttle(req, (tooSoon) => tooSoon
			? res.status(429).json({ error: true, errors: "TOO_MANY_ATTEMPTS" })
			: next())
	})
	// skip never rejects — knownDevice answers false for a bad token, a bad signature or a failed query
	return skip ? (req, res, next) => skip(req).then((s) => (s ? next() : gate(req, res, next))) : gate
}

const deviceKnown = (req) => (req.deviceKnown ??= knownDevice(req))

const ipLimiter = throttledLimiter({ max: 20, keyFn: ipKeyFn })
const ipDayLimiter = throttledLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 100, throttleMs: 15 * 60 * 1000, keyFn: (req) => `day:${ipKeyFn(req)}`, skip: deviceKnown })
const accountLimiter = throttledLimiter({ max: 10, keyFn: accountKeyFn, skip: deviceKnown })

app.get("/status", async (req, res) => {
	try {
		const setup = parseInt((await pool.query("SELECT COUNT(*) FROM auth")).rows[0].count) > 0
		res.json(setup ? { setup: true } : { setup: false, tokenRequired: !!process.env.setup_TOKEN })
	} catch (e) {
		if (e.code === "42P01") return res.json({ setup: false, tokenRequired: !!process.env.setup_TOKEN })
		sendError(res, e)
	}
})

app.post("/setup", blockCrossSite, validateBody, loginLimiter, async (req, res) => {
	const { username, password, token } = req.body
	if (!timingSafeCompare(token, process.env.setup_TOKEN)) return res.status(403).json({ error: true, errors: "SETUP_TOKEN_MISMATCH" })
	if (typeof username !== "string") return res.status(400).json({ error: true })
	if (!isValidPassword(password)) return res.status(400).json({ error: true, errors: "PASSWORD_TOO_SHORT" })
	if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) return res.status(400).json({ error: true, errors: "INVALID_USERNAME" })
	try {
		const hash = await hashPassword(password)
		const result = await withTransaction(async (client) => {
			await client.query("SELECT pg_advisory_xact_lock(1)")
			const noAdmin = (await client.query("SELECT 1 FROM auth WHERE role = 'admin' LIMIT 1")).rowCount === 0
			const target = (await client.query("SELECT role FROM auth WHERE username = $1", [username])).rows[0]
			const allowed = noAdmin && !target
			if (!allowed) return { rowCount: 0 }
			const insert = await client.query(
				"INSERT INTO auth(username, hash, role) VALUES ($1, $2, 'admin')",
				[username, hash]
			)
			await client.query("UPDATE sessions SET revoked = TRUE WHERE username = $1", [username])
			return insert
		})
		if (result.rowCount === 0) return res.status(403).json({ error: true })
		auth.invalidateUser(username)
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.post("/login", blockCrossSite, validateBody, ipLimiter, ipDayLimiter, accountLimiter, passwordCheck, login)
app.post("/verify", authorize, async (req, res) => {
	try {
		const result = await pool.query("SELECT force_password_change, theme FROM auth WHERE username = $1", [req.decoded.username])
		const row = result.rows[0] ?? {}
		res.json({ error: false, role: req.decoded.role, forcePasswordChange: row.force_password_change ?? false, theme: row.theme ?? "system" })
	} catch (e) {
		sendError(res, e)
	}
})

app.put("/theme", authorize, validateBody, async (req, res) => {
	const { theme } = req.body
	if (!["light", "dark", "system"].includes(theme)) return res.status(400).json({ error: true })
	try {
		await pool.query("UPDATE auth SET theme = $1 WHERE username = $2", [theme, req.decoded.username])
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.get("/users", authorize, requireAdmin, async (req, res) => {
	try {
		const result = await pool.query("SELECT username, role, last_login FROM auth ORDER BY username")
		res.json(result.rows)
	} catch (e) {
		sendError(res, e)
	}
})

app.post("/users", authorize, requireAdmin, validateBody, async (req, res) => {
	const { username, role } = req.body
	if (typeof username !== "string" || !username.trim() || !role) return res.status(400).json({ error: true })
	if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) return res.status(400).json({ error: true, errors: "INVALID_USERNAME" })
	if (!["admin", "user"].includes(role)) return res.status(400).json({ error: true })
	try {
		const tempPassword = randomBytes(16).toString("hex")
		const hash = await hashPassword(tempPassword)
		await pool.query("INSERT INTO auth(username, hash, role, force_password_change) VALUES($1, $2, $3, TRUE)", [username, hash, role])
		res.json({ error: false, tempPassword })
	} catch (e) {
		if (e.code === "23505") return sendError(res, new HttpError(400))
		sendError(res, e)
	}
})

app.patch("/users/:username", authorize, requireAdmin, validateBody, async (req, res) => {
	const { username } = req.params
	const { password, role } = req.body
	if (password === undefined && role === undefined) return res.status(400).json({ error: true })
	if (password !== undefined && !isValidPassword(password)) return res.status(400).json({ error: true, errors: "PASSWORD_TOO_SHORT" })
	if (role !== undefined && !["admin", "user"].includes(role)) return res.status(400).json({ error: true })
	let hash
	try {
		if (password !== undefined) {
			hash = await hashPassword(password)
		}
		await withTransaction(async (client) => {
			const target = await getUserOr404(client, username)
			if (target.role === "admin" && role === "user") await assertNotLastAdmin(client, "CANNOT_DEMOTE_LAST_ADMIN")
			const updates = []
			const values = []
			if (role !== undefined) {
				values.push(role)
				updates.push(`role = $${values.length}`)
			}
			if (password !== undefined) {
				values.push(hash)
				updates.push(`hash = $${values.length}`)
				values.push(username !== req.decoded.username)
				updates.push(`force_password_change = $${values.length}`)
			}
			values.push(username)
			await client.query(`UPDATE auth SET ${updates.join(", ")} WHERE username = $${values.length}`, values)
			await client.query("UPDATE sessions SET revoked = TRUE WHERE username = $1 AND jti IS DISTINCT FROM $2", [username, req.decoded.jti])
		})
		auth.invalidateUser(username)
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.get("/users/:username/sessions", authorize, requireAdmin, async (req, res) => {
	const { username } = req.params
	try {
		const result = await pool.query(
			"SELECT id, issued_at, last_seen, ip, user_agent, revoked FROM sessions WHERE username = $1 ORDER BY issued_at DESC",
			[username]
		)
		res.json(result.rows)
	} catch (e) {
		sendError(res, e)
	}
})

app.delete("/sessions/:id", authorize, requireAdmin, async (req, res) => {
	const id = parseInt(req.params.id)
	if (isNaN(id)) return res.status(400).json({ error: true })
	try {
		const result = await pool.query("UPDATE sessions SET revoked = TRUE WHERE id = $1 RETURNING jti", [id])
		if (result.rowCount === 0) return res.status(404).json({ error: true })
		auth.invalidateSession(result.rows[0].jti)
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.delete("/users/:username", authorize, requireAdmin, async (req, res) => {
	const { username } = req.params
	if (username === req.decoded.username) return res.status(400).json({ error: true })
	try {
		await withTransaction(async (client) => {
			const target = await getUserOr404(client, username)
			if (target.role === "admin") await assertNotLastAdmin(client, "CANNOT_DELETE_LAST_ADMIN")
			await client.query("DELETE FROM auth WHERE username = $1", [username])
		})
		auth.invalidateUser(username)
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.post("/password", authorize, validateBody, passwordLimiter, async (req, res) => {
	const { password, currentPassword } = req.body
	if (!isValidPassword(password)) return res.status(400).json({ error: true, errors: "PASSWORD_TOO_SHORT" })
	const username = req.decoded.username
	try {
		await withTransaction(async (client) => {
			const current = (await client.query("SELECT hash, force_password_change FROM auth WHERE username = $1", [username])).rows[0]
			if (!current) throw new HttpError(404)
			if (!current.force_password_change && !(await bcrypt.compare(currentPassword ?? "", current.hash))) throw new HttpError(400, "WRONG_CURRENT_PASSWORD")
			const hash = await hashPassword(password)
			await client.query("UPDATE auth SET hash = $1, force_password_change = FALSE WHERE username = $2", [hash, username])
			await client.query("UPDATE sessions SET revoked = TRUE WHERE username = $1 AND jti IS DISTINCT FROM $2", [username, req.decoded.jti])
		})
		auth.invalidateUser(username)
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.post("/logout", authorize, async (req, res) => {
	try {
		if (req.decoded?.jti) {
			await pool.query("UPDATE sessions SET revoked = TRUE WHERE jti = $1", [req.decoded.jti])
			auth.invalidateSession(req.decoded.jti)
		}
		res.clearCookie("bearertoken", { httpOnly: true, secure: COOKIE_SECURE, sameSite: "lax" })
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.rateLimit = rateLimit
module.exports = app
