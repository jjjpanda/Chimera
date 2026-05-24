const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")

const schedulableUrls = ["/convert/createVideo", "/convert/createZip", "/file/pathMetrics", "/file/pathDelete", "/file/pathClean"]
const objectUrl = "/livestream/feed/"

const verifyJwt = (token, req, res, next, pool) => {
	const { method } = req
	jwt.verify(token, secretKey, async (err, decoded) => {
		if (err) {
			method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({ error: "unauthorized" })
			return
		}
		if (pool) {
			try {
				const r = await pool.query("SELECT role FROM auth WHERE username = $1", [decoded.username])
				if (r.rowCount === 0) {
					method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({ error: "unauthorized" })
					return
				}
				decoded.role = r.rows[0].role
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
		const objectTokenCookie = req.cookies && req.cookies.objecttoken
		if (bearerTokenCookie && bearerTokenCookie.includes("Bearer")) {
			verifyJwt(bearerTokenCookie.split(/%20|\s+/)[1], req, res, next, pool)
		} else if (objectTokenCookie) {
			if (req.path.includes(objectUrl) && objectTokenCookie == process.env.object_AUTH) {
				next()
			} else {
				unauthorized()
			}
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