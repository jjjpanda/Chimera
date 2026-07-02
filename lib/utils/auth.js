const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")

const schedulableUrls = ["/convert/createVideo", "/convert/createZip", "/file/pathMetrics", "/file/pathDelete", "/file/pathClean", "/file/pathAutoClean"]
const forcedChangeAllowed = ["/authorization/password", "/authorization/verify", "/authorization/logout"]
const sessionCache = new Map()
const SESSION_CACHE_MS = 5000

let publishInvalidation = null
let epoch = 0

const invalidateSession = (jti) => {
	epoch++
	sessionCache.delete(jti)
	publishInvalidation?.("sessionInvalidate", jti)
}
const invalidateAllSessions = () => {
	epoch++
	sessionCache.clear()
	publishInvalidation?.("sessionInvalidateAll")
}

const connectSessionSync = (client) => {
	publishInvalidation = client ? (event, jti) => client.emit(event, jti) : null
	if (!client) return
	client.on("sessionInvalidate", (jti) => { epoch++; sessionCache.delete(jti) })
	client.on("sessionInvalidateAll", () => { epoch++; sessionCache.clear() })
}

const verifyJwt = (token, req, res, next, pool) => {
	const { method } = req
	const unauthorized = () => method == "GET" ? res.redirect(303, "/?loginForm") : res.status(401).send({ error: "unauthorized" })
	jwt.verify(token, secretKey, async (err, decoded) => {
		if (err) {
			unauthorized()
			return
		}
		if (pool) {
			if (!decoded.jti) {
				unauthorized()
				return
			}
			try {
				const cached = sessionCache.get(decoded.jti)
				let session
				if (cached && Date.now() - cached.time < SESSION_CACHE_MS) {
					session = cached.data
				} else {
					for (const [key, entry] of sessionCache) {
						if (Date.now() - entry.time >= SESSION_CACHE_MS) sessionCache.delete(key)
					}
					const epochBefore = epoch
					const r = await pool.query(
						"SELECT a.role, a.force_password_change, s.revoked, s.last_seen FROM auth a LEFT JOIN sessions s ON a.username = s.username AND s.jti = $2 WHERE a.username = $1",
						[decoded.username, decoded.jti]
					)
					session = r.rowCount === 0 ? null : r.rows[0]
					if (epoch === epochBefore) sessionCache.set(decoded.jti, { data: session, time: Date.now() })
				}
				if (!session) {
					unauthorized()
					return
				}
				decoded.role = session.role
				if (session.force_password_change && !forcedChangeAllowed.includes((req.originalUrl || "").split("?")[0])) {
					unauthorized()
					return
				}
				if (session.revoked !== false) {
					unauthorized()
					return
				}
				if (new Date() - new Date(session.last_seen) > 5 * 60 * 1000) {
					pool.query("UPDATE sessions SET last_seen = NOW() WHERE jti = $1", [decoded.jti]).catch(console.error)
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
	invalidateSession,
	invalidateAllSessions,
	connectSessionSync,

	requireAdmin: (req, res, next) => {
		if (req.decoded?.role === "admin") next()
		else res.status(403).json({ error: "forbidden" })
	},

	schedulableUrls: schedulableUrls
}