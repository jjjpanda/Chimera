const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const { randomUUID } = require("crypto")
const { createPool } = require("lib")

const pool = createPool()

const DUMMY_HASH = bcrypt.hashSync("invalid", 10)

class HttpError extends Error {
	constructor(status, errors) {
		super(errors || "http error")
		this.status = status
		this.errors = errors
	}
}

const withTransaction = async (fn) => {
	const client = await pool.connect()
	try {
		await client.query("BEGIN")
		const result = await fn(client)
		await client.query("COMMIT")
		return result
	} catch (e) {
		await client.query("ROLLBACK").catch(() => {})
		throw e
	} finally {
		client.release()
	}
}

module.exports = {
	pool,
	withTransaction,
	HttpError,
	passwordCheck: (req, res, next) => {
		const { username, password } = req.body
		const deny = () => res.status(400).json({ error: true, errors: "Invalid username or password" })
		const serverError = () => res.status(500).json({ error: true })

		pool.query("SELECT hash, role, force_password_change, temp_password_expires, theme FROM auth WHERE username = $1", [username], (err, values) => {
			if (err) return serverError()
			const row = values.rows[0]
			bcrypt.compare(password === undefined ? "" : password, row && row.hash ? row.hash : DUMMY_HASH, (err, success) => {
				if (err) return serverError()
				if (!success || !row || !row.hash) return deny()
				if (row.force_password_change && row.temp_password_expires && new Date(row.temp_password_expires) < new Date()) return deny()
				req.userRole = row.role
				req.forcePasswordChange = row.force_password_change
				req.userTheme = row.theme ?? "system"
				next()
			})
		})
	},

	login: async (req, res) => {
		const { username } = req.body
		const jti = randomUUID()
		const ip = req.ip || null
		const userAgent = req.headers["user-agent"] || null
		pool.query("UPDATE auth SET last_login = NOW() WHERE username = $1", [username]).catch(() => {})
		try {
			await pool.query("INSERT INTO sessions(username, jti, ip, user_agent) VALUES($1, $2, $3, $4)", [username, jti, ip, userAgent])
		} catch {
			return res.status(500).json({ error: true })
		}
		jwt.sign({ username, role: req.userRole, jti }, secretKey, { expiresIn: "30d" },
			(err, token) => {
				if (err || !token) return res.status(500).json({ error: true })
				res.cookie("bearertoken", `Bearer ${token}`, {
					maxAge: 2592000000,
					httpOnly: true,
					secure: req.secure,
					sameSite: "lax"
				})
				res.send({ error: false, role: req.userRole, forcePasswordChange: req.forcePasswordChange, theme: req.userTheme })
			}
		)
	}
}
