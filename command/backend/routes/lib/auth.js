const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")

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

	login: (req, res) => {
		const { username } = req.body
		pool.query("UPDATE auth SET last_login = NOW() WHERE username = $1", [username]).catch(() => {})
		jwt.sign({ username, role: req.userRole }, secretKey, { expiresIn: "30d" },
			(err, token) => {
				res.cookie("bearertoken", `Bearer ${token}`, {
					maxAge: 2592000000
				})
				res.send({ error: false, role: req.userRole })
			}
		)
	}
}
