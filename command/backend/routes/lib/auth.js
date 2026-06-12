const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const { randomUUID } = require("crypto")

const Pool = require("pg").Pool
const pool = new Pool({
	user: process.env.database_USER,
	host: process.env.database_HOST,
	database: process.env.database_NAME,
	password: process.env.database_PASSWORD,
	port: process.env.database_PORT,
})

module.exports = {
	pool,
	passwordCheck: (req, res, next) => {
		const { username, password } = req.body

		pool.query("SELECT hash, role FROM auth WHERE username = $1", [username], (err, values) => {
			if (!err && values.rows.length > 0 && values.rows[0].hash) {
				const { hash, role } = values.rows[0]
				bcrypt.compare(password == undefined ? "" : password, hash, (err, success) => {
					if (!err && success) {
						req.userRole = role
						next()
					} else {
						res.status(400).json({ error: true, errors: "Password Incorrect" })
					}
				})
			} else {
				res.status(400).json({ error: true, errors: "Password Unable to Be Verified" })
			}
		})
	},

	login: async (req, res) => {
		const { username } = req.body
		const jti = randomUUID()
		const ip = (req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim() || null
		const userAgent = req.headers["user-agent"] || null
		pool.query("UPDATE auth SET last_login = NOW() WHERE username = $1", [username]).catch(() => {})
		try {
			await pool.query("INSERT INTO sessions(username, jti, ip, user_agent) VALUES($1, $2, $3, $4)", [username, jti, ip, userAgent])
		} catch {
			return res.status(500).json({ error: true })
		}
		jwt.sign({ username, role: req.userRole, jti }, secretKey, { expiresIn: "30d" },
			(err, token) => {
				res.cookie("bearertoken", `Bearer ${token}`, {
					maxAge: 2592000000
				})
				res.send({ error: false, role: req.userRole })
			}
		)
	}
}
