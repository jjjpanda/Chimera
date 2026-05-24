var express = require("express")
var { validateBody, auth } = require("lib")
const { requireAdmin } = auth
const { passwordCheck, login, pool } = require("./lib/auth.js")
const authorize = auth.createAuthorize(pool)

const bcrypt = require("bcryptjs")

const app = express.Router()

app.get("/status", async (req, res) => {
	try {
		const result = await pool.query("SELECT COUNT(*) FROM auth")
		res.json({ setup: parseInt(result.rows[0].count) > 0, tokenRequired: !!process.env.setup_TOKEN })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.post("/setup", validateBody, async (req, res) => {
	const { username, password, token } = req.body
	if (process.env.setup_TOKEN && token !== process.env.setup_TOKEN) return res.status(403).json({ error: true })
	if (!username || !password) return res.status(400).json({ error: true })
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

app.post("/login", validateBody, passwordCheck, login)
app.post("/verify", authorize, (req, res) => {
	res.json({ error: false, role: req.decoded.role })
})

app.get("/users", authorize, requireAdmin, async (req, res) => {
	try {
		const result = await pool.query("SELECT username, role FROM auth ORDER BY username")
		res.json(result.rows)
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.post("/users", authorize, requireAdmin, validateBody, async (req, res) => {
	const { username, password, role } = req.body
	if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password.trim() || !role) return res.status(400).json({ error: true })
	if (!/^[^/]+$/.test(username) || username.trim() !== username) return res.status(400).json({ error: true })
	if (!["admin", "user"].includes(role)) return res.status(400).json({ error: true })
	try {
		const salt = await bcrypt.genSalt(10)
		const hash = await bcrypt.hash(password, salt)
		await pool.query("INSERT INTO auth(username, hash, role) VALUES($1, $2, $3)", [username, hash, role])
		res.json({ error: false })
	} catch (e) {
		res.status(e.code === "23505" ? 400 : 500).json({ error: true })
	}
})

app.post("/users/update/:username", authorize, requireAdmin, validateBody, async (req, res) => {
	const { username } = req.params
	const { password, role } = req.body
	if (password === undefined && role === undefined) return res.status(400).json({ error: true })
	if (password !== undefined && (typeof password !== "string" || !password.trim())) return res.status(400).json({ error: true })
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

module.exports = app
