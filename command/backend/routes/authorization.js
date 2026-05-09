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
	try {
		const salt = await bcrypt.genSalt(10)
		const hash = await bcrypt.hash(password, salt)
		const result = await pool.query(
			"INSERT INTO auth(username, hash, role) SELECT $1, $2, 'admin' WHERE NOT EXISTS (SELECT 1 FROM auth)",
			[username, hash]
		)
		if (result.rowCount === 0) return res.status(403).json({ error: true })
		res.json({ error: false })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.post("/login", validateBody, passwordCheck, login)
app.post("/verify", authorize, (req, res) => {
	res.json({ error: false })
})

module.exports = app
