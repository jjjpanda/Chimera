var express = require("express")
var { validateBody, auth } = require("lib")
const { requireAdmin } = auth
const { passwordCheck, login, pool } = require("./lib/auth.js")
const authorize = auth.createAuthorize(pool)

const bcrypt = require("bcryptjs")
const { randomBytes } = require("crypto")
const memory = require("memory")

const app = express.Router()

const isValidPassword = (p) => typeof p === "string" && p.length >= 8
const PASSWORD_REQUIREMENT = "Password must be at least 8 characters."

const sharedAttempts = process.env.memory_ON == "true"
const memoryClient = sharedAttempts ? memory.client("AUTH") : null

const rateLimit = ({ windowMs, max }) => {
	const store = sharedAttempts ? null : memory.loginAttempts()
	const reserve = (key, cb) => {
		if (!sharedAttempts) return store.loginReserve(key, max, windowMs, cb)
		if (!memoryClient.connected) return cb(false)
		memoryClient.timeout(1000).emit("loginReserve", key, max, windowMs, (err, blocked) => cb(!err && blocked))
	}
	const release = (key) => {
		if (!sharedAttempts) return store.loginRelease(key)
		if (memoryClient.connected) memoryClient.emit("loginRelease", key)
	}
	return (req, res, next) => {
		const key = `${req.ip || ""}:${req.path}`
		reserve(key, (blocked) => {
			if (blocked) return res.status(429).json({ error: true, errors: "Too many attempts" })
			res.on("finish", () => {
				if (res.statusCode < 400) release(key)
			})
			next()
		})
	}
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })

app.get("/status", async (req, res) => {
	try {
		const result = await pool.query("SELECT COUNT(*) FROM auth")
		res.json({ setup: parseInt(result.rows[0].count) > 0, tokenRequired: !!process.env.setup_TOKEN })
	} catch (e) {
		if (e.code === "42P01") return res.json({ setup: false, tokenRequired: !!process.env.setup_TOKEN })
		res.status(500).json({ error: true })
	}
})

app.post("/setup", loginLimiter, validateBody, async (req, res) => {
	const { username, password, token } = req.body
	if (process.env.setup_TOKEN && token !== process.env.setup_TOKEN) return res.status(403).json({ error: true })
	if (!username) return res.status(400).json({ error: true })
	if (!isValidPassword(password)) return res.status(400).json({ error: true, errors: PASSWORD_REQUIREMENT })
	if (!/^[^/]+$/.test(username)) return res.status(400).json({ error: true })
	let client
	try {
		client = await pool.connect()
		const salt = await bcrypt.genSalt(10)
		const hash = await bcrypt.hash(password, salt)
		await client.query("BEGIN")
		await client.query("SELECT pg_advisory_xact_lock(1)")
		const result = await client.query(
			"INSERT INTO auth(username, hash, role) SELECT $1, $2, 'admin' WHERE NOT EXISTS (SELECT 1 FROM auth)",
			[username, hash]
		)
		await client.query("COMMIT")
		if (result.rowCount === 0) return res.status(403).json({ error: true })
		res.json({ error: false })
	} catch (e) {
		if (client) await client.query("ROLLBACK").catch(() => {})
		res.status(500).json({ error: true })
	} finally {
		if (client) client.release()
	}
})

app.post("/login", loginLimiter, validateBody, passwordCheck, login)
app.post("/verify", authorize, async (req, res) => {
	try {
		const result = await pool.query("SELECT force_password_change FROM auth WHERE username = $1", [req.decoded.username])
		const forcePasswordChange = result.rows[0]?.force_password_change ?? false
		res.json({ error: false, role: req.decoded.role, forcePasswordChange })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.get("/users", authorize, requireAdmin, async (req, res) => {
	try {
		const result = await pool.query("SELECT username, role, last_login FROM auth ORDER BY username")
		res.json(result.rows)
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.post("/users", authorize, requireAdmin, validateBody, async (req, res) => {
	const { username, role } = req.body
	if (typeof username !== "string" || !username.trim() || !role) return res.status(400).json({ error: true })
	if (!/^[^/]+$/.test(username) || username.trim() !== username) return res.status(400).json({ error: true })
	if (!["admin", "user"].includes(role)) return res.status(400).json({ error: true })
	try {
		const tempPassword = randomBytes(16).toString("hex")
		const salt = await bcrypt.genSalt(10)
		const hash = await bcrypt.hash(tempPassword, salt)
		await pool.query("INSERT INTO auth(username, hash, role, force_password_change, temp_password_expires) VALUES($1, $2, $3, TRUE, NOW() + INTERVAL '24 hours')", [username, hash, role])
		res.json({ error: false, tempPassword })
	} catch (e) {
		res.status(e.code === "23505" ? 400 : 500).json({ error: true })
	}
})

app.post("/users/update/:username", authorize, requireAdmin, validateBody, async (req, res) => {
	const { username } = req.params
	const { password, role } = req.body
	if (password === undefined && role === undefined) return res.status(400).json({ error: true })
	if (password !== undefined && !isValidPassword(password)) return res.status(400).json({ error: true, errors: PASSWORD_REQUIREMENT })
	if (role !== undefined && !["admin", "user"].includes(role)) return res.status(400).json({ error: true })
	let client
	try {
		client = await pool.connect()
		await client.query("BEGIN")
		const target = await client.query("SELECT role FROM auth WHERE username = $1", [username])
		if (target.rowCount === 0) {
			await client.query("ROLLBACK")
			return res.status(404).json({ error: true })
		}
		if (target.rows[0].role === "admin" && role === "user") {
			const adminRows = await client.query("SELECT username FROM auth WHERE role = 'admin' FOR UPDATE")
			if (adminRows.rows.length <= 1) {
				await client.query("ROLLBACK")
				return res.status(400).json({ error: true, errors: "cannot demote last admin" })
			}
		}
		const updates = []
		const values = []
		if (role !== undefined) {
			values.push(role)
			updates.push(`role = $${values.length}`)
		}
		if (password !== undefined) {
			const salt = await bcrypt.genSalt(10)
			values.push(await bcrypt.hash(password, salt))
			updates.push(`hash = $${values.length}`)
			updates.push("force_password_change = FALSE", "temp_password_expires = NULL")
		}
		values.push(username)
		await client.query(`UPDATE auth SET ${updates.join(", ")} WHERE username = $${values.length}`, values)
		await client.query("COMMIT")
		res.json({ error: false })
	} catch (e) {
		if (client) await client.query("ROLLBACK").catch(() => {})
		res.status(500).json({ error: true })
	} finally {
		if (client) client.release()
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
		res.status(500).json({ error: true })
	}
})

app.delete("/sessions/:id", authorize, requireAdmin, async (req, res) => {
	const id = parseInt(req.params.id)
	if (isNaN(id)) return res.status(400).json({ error: true })
	try {
		const result = await pool.query("UPDATE sessions SET revoked = TRUE WHERE id = $1 RETURNING id", [id])
		if (result.rowCount === 0) return res.status(404).json({ error: true })
		res.json({ error: false })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.delete("/users/:username", authorize, requireAdmin, async (req, res) => {
	const { username } = req.params
	if (username === req.decoded.username) return res.status(400).json({ error: true })
	let client
	try {
		client = await pool.connect()
		await client.query("BEGIN")
		const target = await client.query("SELECT role FROM auth WHERE username = $1", [username])
		if (target.rowCount === 0) {
			await client.query("ROLLBACK")
			return res.status(404).json({ error: true })
		}
		if (target.rows[0].role === "admin") {
			const adminRows = await client.query("SELECT username FROM auth WHERE role = 'admin' FOR UPDATE")
			if (adminRows.rows.length <= 1) {
				await client.query("ROLLBACK")
				return res.status(400).json({ error: true, errors: "cannot delete last admin" })
			}
		}
		await client.query("DELETE FROM auth WHERE username = $1", [username])
		await client.query("COMMIT")
		res.json({ error: false })
	} catch (e) {
		if (client) await client.query("ROLLBACK").catch(() => {})
		res.status(500).json({ error: true })
	} finally {
		if (client) client.release()
	}
})

app.post("/password", authorize, validateBody, async (req, res) => {
	const { password } = req.body
	if (!isValidPassword(password)) return res.status(400).json({ error: true, errors: PASSWORD_REQUIREMENT })
	const username = req.decoded.username
	try {
		const salt = await bcrypt.genSalt(10)
		const hash = await bcrypt.hash(password, salt)
		await pool.query("UPDATE auth SET hash = $1, force_password_change = FALSE, temp_password_expires = NULL WHERE username = $2", [hash, username])
		res.json({ error: false })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.post("/logout", authorize, async (req, res) => {
	try {
		if (req.decoded?.jti) {
			await pool.query("UPDATE sessions SET revoked = TRUE WHERE jti = $1", [req.decoded.jti])
		}
		res.clearCookie("bearertoken", { httpOnly: true, secure: process.env.NODE_ENV !== "development", sameSite: "lax" })
		res.json({ error: false })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.rateLimit = rateLimit
module.exports = app
