const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const { randomUUID, createHash } = require("crypto")
const { createPool, withTransaction } = require("lib")

const pool = createPool("COMMAND POOL ERROR")

const DUMMY_HASH = bcrypt.hashSync("invalid", 10)
const COOKIE_SECURE = process.env.command_COOKIE_SECURE === "true"
const DEVICE_TOKEN_MAX_AGE = 365 * 24 * 60 * 60 * 1000

const deviceKey = (hash) => createHash("sha256").update(hash).digest("base64url")

class HttpError extends Error {
	constructor(status, errors) {
		super(errors || "http error")
		this.status = status
		this.errors = errors
	}
}

module.exports = {
	pool,
	withTransaction: (fn) => withTransaction(pool, fn),
	HttpError,
	COOKIE_SECURE,
	/**
	 * True when the request carries a device token this server issued to the
	 * same username on an earlier successful login, and that username's
	 * password has not changed since. A password reset or a deleted account
	 * revokes every device token it issued.
	 */
	knownDevice: async (req) => {
		const token = req.cookies?.devicetoken
		if (!token) return false
		try {
			const decoded = jwt.verify(token, secretKey)
			if (decoded.device !== true || decoded.username !== req.body?.username || !decoded.dk) return false
			const row = (await pool.query("SELECT hash FROM auth WHERE username = $1", [decoded.username])).rows[0]
			return !!row?.hash && deviceKey(row.hash) === decoded.dk
		} catch {
			return false
		}
	},

	passwordCheck: (req, res, next) => {
		const { username, password } = req.body
		const deny = () => req.accountThrottled
			? res.status(429).json({ error: true, errors: "TOO_MANY_ATTEMPTS" })
			: res.status(400).json({ error: true, errors: "INVALID_CREDENTIALS" })
		const serverError = () => res.status(500).json({ error: true })

		pool.query("SELECT hash, role, force_password_change, theme FROM auth WHERE username = $1", [username], (err, values) => {
			if (err) return serverError()
			const row = values.rows[0]
			bcrypt.compare(password === undefined ? "" : password, row && row.hash ? row.hash : DUMMY_HASH, (err, success) => {
				if (err) return serverError()
				if (!success || !row || !row.hash) return deny()
				req.userRole = row.role
				req.deviceKey = deviceKey(row.hash)
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
					secure: COOKIE_SECURE,
					sameSite: "lax"
				})
				res.cookie("devicetoken", jwt.sign({ username, device: true, dk: req.deviceKey }, secretKey, { expiresIn: "365d" }), {
					maxAge: DEVICE_TOKEN_MAX_AGE,
					httpOnly: true,
					secure: COOKIE_SECURE,
					sameSite: "lax"
				})
				res.send({ error: false, role: req.userRole, forcePasswordChange: req.forcePasswordChange, theme: req.userTheme })
			}
		)
	}
}
