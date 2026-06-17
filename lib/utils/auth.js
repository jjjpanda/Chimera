const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")

const schedulableUrls = ["/convert/createVideo", "/convert/createZip", "/file/pathMetrics", "/file/pathDelete", "/file/pathClean", "/file/pathAutoClean"]
const forcedChangeAllowed = ["/authorization/password", "/authorization/verify", "/authorization/logout"]
const verifyJwt = (token, req, res, next, pool) => {
	const { method } = req
	const unauthorized = () => method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({ error: "unauthorized" })
	jwt.verify(token, secretKey, async (err, decoded) => {
		if (err) {
			unauthorized()
			return
		}
		if (pool) {
			try {
				const r = await pool.query("SELECT role, force_password_change FROM auth WHERE username = $1", [decoded.username])
				if (r.rowCount === 0) {
					unauthorized()
					return
				}
				decoded.role = r.rows[0].role
				if (r.rows[0].force_password_change && !forcedChangeAllowed.includes((req.originalUrl || "").split("?")[0])) {
					unauthorized()
					return
				}
				if (decoded.jti) {
					const s = await pool.query("SELECT revoked FROM sessions WHERE jti = $1", [decoded.jti])
					if (s.rowCount === 0 || s.rows[0].revoked) {
						unauthorized()
						return
					}
					pool.query("UPDATE sessions SET last_seen = NOW() WHERE jti = $1", [decoded.jti]).catch(() => {})
				}
			} catch (e) {
				res.status(500).send({ error: "server error" })
				return
			}
		}
		req.decoded = decoded
		next()
	})
}

const makeAuthorize = (pool) => (req, res, next) => {
	const { method } = req
	const unauthorized = () => method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({ error: "unauthorized" })
	if (req.headers.authorization != undefined && req.headers.authorization == process.env.scheduler_AUTH && schedulableUrls.includes(req.path)) {
		req.decoded = { username: "scheduler", role: "admin" }
		next()
	} else {
		const bearerTokenCookie = req.cookies && req.cookies.bearertoken
		if (bearerTokenCookie && bearerTokenCookie.includes("Bearer")) {
			verifyJwt(bearerTokenCookie.split(/%20|\s+/)[1], req, res, next, pool)
		} else unauthorized()
	}
}

module.exports = {
	createAuthorize: makeAuthorize,

	requireAdmin: (req, res, next) => {
		if (req.decoded?.role === "admin") next()
		else res.status(403).json({ error: "forbidden" })
	},

	schedulableUrls: schedulableUrls
}