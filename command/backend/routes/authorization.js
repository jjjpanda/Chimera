var express = require("express")
var { validateBody, auth, password, timingSafeCompare } = require("lib")
const { requireAdmin } = auth
const { passwordCheck, login, pool, withTransaction, HttpError } = require("./lib/auth.js")
const forcedChangeAllowed = ["/authorization/password", "/authorization/verify", "/authorization/logout"]
const authorize = auth.createAuthorize(pool, { forcedChangeAllowed })

const bcrypt = require("bcryptjs")
const { randomBytes } = require("crypto")
const memory = require("memory")

const app = express.Router()

const { minLength: MIN_PASSWORD_LENGTH, requirement: PASSWORD_REQUIREMENT } = password
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

const sharedAttempts = process.env.memory_ON == "true"
const memoryClient = sharedAttempts ? memory.client("AUTH") : null
if (memoryClient) auth.connectSessionSync(memoryClient)

const rateLimit = ({ windowMs, max, keyFn }) => {
	const local = memory.loginAttempts()
	const getKey = keyFn || ((req) => `${req.ip || ""}:${req.path}`)
	const reserveLocal = (key, cb) =>
		local.loginReserve(key, max, windowMs, (blocked) => cb(blocked, () => local.loginRelease(key)))
	const reserve = (key, cb) => {
		if (!sharedAttempts || !memoryClient.connected) return reserveLocal(key, cb)
		memoryClient.timeout(1000).emit("loginReserve", key, max, windowMs, (err, blocked) => {
			if (err) {
				memoryClient.emit("loginRelease", key)
				return reserveLocal(key, cb)
			}
			cb(blocked, () => memoryClient.emit("loginRelease", key))
		})
	}
	return (req, res, next) => {
		const key = getKey(req)
		reserve(key, (blocked, release) => {
			if (blocked) return res.status(429).json({ error: true, errors: "Too many attempts" })
			res.on("finish", () => {
				if (res.statusCode < 400 || res.statusCode >= 500) release()
			})
			next()
		})
	}
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })
const accountLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyFn: (req) => `user:${String(req.body?.username ?? "")}` })

app.get("/status", async (req, res) => {
	try {
		const result = await pool.query("SELECT COUNT(*) FROM auth")
		res.json({ setup: parseInt(result.rows[0].count) > 0, tokenRequired: !!process.env.setup_TOKEN })
	} catch (e) {
		if (e.code === "42P01") return res.json({ setup: false, tokenRequired: !!process.env.setup_TOKEN })
		sendError(res, e)
	}
})

app.post("/setup", validateBody, loginLimiter, async (req, res) => {
	const { username, password, token } = req.body
	if (!process.env.setup_TOKEN || !timingSafeCompare(token, process.env.setup_TOKEN)) return res.status(403).json({ error: true })
	if (typeof username !== "string") return res.status(400).json({ error: true })
	if (!isValidPassword(password)) return res.status(400).json({ error: true, errors: PASSWORD_REQUIREMENT })
	if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) return res.status(400).json({ error: true, errors: "Username must be 3-50 characters and contain only letters, numbers, dashes, dots, and underscores." })
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

app.post("/login", validateBody, loginLimiter, accountLimiter, passwordCheck, login)
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
	if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) return res.status(400).json({ error: true, errors: "Username must be 3-50 characters and contain only letters, numbers, dashes, dots, and underscores." })
	if (!["admin", "user"].includes(role)) return res.status(400).json({ error: true })
	try {
		const tempPassword = randomBytes(16).toString("hex")
		const hash = await hashPassword(tempPassword)
		await pool.query("INSERT INTO auth(username, hash, role, force_password_change, temp_password_expires) VALUES($1, $2, $3, TRUE, NOW() + INTERVAL '24 hours')", [username, hash, role])
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
	if (password !== undefined && !isValidPassword(password)) return res.status(400).json({ error: true, errors: PASSWORD_REQUIREMENT })
	if (role !== undefined && !["admin", "user"].includes(role)) return res.status(400).json({ error: true })
	let hash
	try {
		if (password !== undefined) {
			hash = await hashPassword(password)
		}
		await withTransaction(async (client) => {
			const target = await getUserOr404(client, username)
			if (target.role === "admin" && role === "user") await assertNotLastAdmin(client, "cannot demote last admin")
			const updates = []
			const values = []
			if (role !== undefined) {
				values.push(role)
				updates.push(`role = $${values.length}`)
			}
			if (password !== undefined) {
				values.push(hash)
				updates.push(`hash = $${values.length}`)
				updates.push("force_password_change = FALSE", "temp_password_expires = NULL")
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
			if (target.role === "admin") await assertNotLastAdmin(client, "cannot delete last admin")
			await client.query("DELETE FROM auth WHERE username = $1", [username])
		})
		auth.invalidateUser(username)
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.post("/password", authorize, validateBody, async (req, res) => {
	const { password, currentPassword } = req.body
	if (!isValidPassword(password)) return res.status(400).json({ error: true, errors: PASSWORD_REQUIREMENT })
	const username = req.decoded.username
	try {
		const hash = await hashPassword(password)
		await withTransaction(async (client) => {
			const current = (await client.query("SELECT hash, force_password_change FROM auth WHERE username = $1", [username])).rows[0]
			if (!current) throw new HttpError(404)
			if (!current.force_password_change && !(await bcrypt.compare(currentPassword ?? "", current.hash))) throw new HttpError(400, "Current password is incorrect")
			await client.query("UPDATE auth SET hash = $1, force_password_change = FALSE, temp_password_expires = NULL WHERE username = $2", [hash, username])
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
		res.clearCookie("bearertoken", { httpOnly: true, secure: req.secure, sameSite: "lax" })
		res.json({ error: false })
	} catch (e) {
		sendError(res, e)
	}
})

app.rateLimit = rateLimit
module.exports = app
