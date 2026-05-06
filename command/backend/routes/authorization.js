var express = require("express")
var { validateBody, auth } = require("lib")
const { authorize } = auth
const { passwordCheck, login, pool } = require("./lib/auth.js")

const bcrypt = require("bcryptjs")

const app = express.Router()

app.get("/status", async (req, res) => {
	try {
		const result = await pool.query("SELECT COUNT(*) FROM auth")
		res.json({ setup: parseInt(result.rows[0].count) > 0 })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.post("/setup", validateBody, async (req, res) => {
	const { username, password } = req.body
	if (!username || !password) return res.status(400).json({ error: true })
	const client = await pool.connect()
	try {
		await client.query("BEGIN")
		const check = await client.query("SELECT COUNT(*) FROM auth FOR UPDATE")
		if (parseInt(check.rows[0].count) > 0) {
			await client.query("ROLLBACK")
			return res.status(403).json({ error: true })
		}
		const salt = await bcrypt.genSalt(10)
		const hash = await bcrypt.hash(password, salt)
		await client.query("INSERT INTO auth(username, hash) VALUES($1, $2)", [username, hash])
		await client.query("COMMIT")
		res.json({ error: false })
	} catch (e) {
		await client.query("ROLLBACK")
		if (e.code === "23505") return res.status(403).json({ error: true })
		res.status(500).json({ error: true })
	} finally {
		client.release()
	}
})

app.post("/login", validateBody, passwordCheck, login)
app.post("/verify", authorize, (req, res) => {
	res.json({ error: false })
})

module.exports = app
