const secretKey = process.env.SECRETKEY
const jwt = require("jsonwebtoken")
const timingSafeCompare = require("./timingSafeCompare.js")

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const SAME_SITE_FETCH = new Set(["same-origin", "same-site", "none"])

const hostOf = (url) => { try { return new URL(url).host } catch (e) { return null } }

const isCrossSite = (req) => {
	if (SAFE_METHODS.has(req.method)) return false
	const site = req.headers["sec-fetch-site"]
	if (site) return !SAME_SITE_FETCH.has(site)
	const origin = req.headers.origin
	if (!origin) return false
	return hostOf(origin) !== req.headers.host
}

const sessionCache = new Map()
const SESSION_CACHE_MS = 5000

setInterval(() => {
	const now = Date.now()
	for (const [key, entry] of sessionCache) {
		if (now - entry.time >= SESSION_CACHE_MS) sessionCache.delete(key)
	}
}, SESSION_CACHE_MS).unref()

let publishInvalidation = null
let epoch = 0

const dropUserEntries = (username) => {
	for (const [jti, entry] of sessionCache) {
		if (entry.username === username) sessionCache.delete(jti)
	}
}

const invalidateSession = (jti) => {
	epoch++
	sessionCache.delete(jti)
	publishInvalidation?.("sessionInvalidate", jti)
}
const invalidateUser = (username) => {
	epoch++
	dropUserEntries(username)
	publishInvalidation?.("sessionInvalidateUser", username)
}
const invalidateAllSessions = () => {
	epoch++
	sessionCache.clear()
	publishInvalidation?.("sessionInvalidateAll")
}

const connectSessionSync = (client) => {
	publishInvalidation = client ? (event, arg) => client.emit(event, arg) : null
	if (!client) return
	client.on("sessionInvalidate", (jti) => { epoch++; sessionCache.delete(jti) })
	client.on("sessionInvalidateUser", (username) => { epoch++; dropUserEntries(username) })
	client.on("sessionInvalidateAll", () => { epoch++; sessionCache.clear() })
}

const isNavigation = (req) => {
	const mode = req.headers["sec-fetch-mode"]
	return req.method === "GET" && (mode === "navigate" || (!mode && (req.headers.accept || "").includes("text/html")))
}

const respondUnauthorized = (req, res) =>
	isNavigation(req) ? res.redirect(303, "/?loginForm") : res.status(401).send({ error: "unauthorized" })

const verifyJwt = (token, req, res, next, pool, forcedChangeAllowed) => {
	const unauthorized = () => respondUnauthorized(req, res)
	jwt.verify(token, secretKey, { algorithms: ["HS256"] }, async (err, decoded) => {
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
					const epochBefore = epoch
					const r = await pool.query(
						"SELECT a.role, a.force_password_change, s.revoked, s.last_seen FROM auth a LEFT JOIN sessions s ON a.username = s.username AND s.jti = $2 WHERE a.username = $1",
						[decoded.username, decoded.jti]
					)
					session = r.rowCount === 0 ? null : r.rows[0]
					if (epoch === epochBefore) sessionCache.set(decoded.jti, { data: session, username: decoded.username, time: Date.now() })
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
					session.last_seen = new Date()
					pool.query("UPDATE sessions SET last_seen = NOW() WHERE jti = $1", [decoded.jti]).catch(console.error)
				}
			} catch (e) {
				if (isNavigation(req)) res.redirect(303, "/?loginForm")
				else res.status(500).send({ error: "server error" })
				return
			}
		}
		req.decoded = decoded
		next()
	})
}

const makeAuthorize = (pool, { schedulableUrls = [], forcedChangeAllowed = [] } = {}) => (req, res, next) => {
	const unauthorized = () => respondUnauthorized(req, res)
	if (process.env.scheduler_AUTH && timingSafeCompare(req.headers.authorization, process.env.scheduler_AUTH) && schedulableUrls.includes(req.path)) {
		req.decoded = { username: "scheduler", role: "admin" }
		next()
	} else {
		const bearerTokenCookie = req.cookies && req.cookies.bearertoken
		if (bearerTokenCookie && bearerTokenCookie.includes("Bearer")) {
			if (isCrossSite(req)) return res.status(403).send({ error: "forbidden" })
			verifyJwt(bearerTokenCookie.split(/%20|\s+/)[1], req, res, next, pool, forcedChangeAllowed)
		} else unauthorized()
	}
}

module.exports = {
	createAuthorize: makeAuthorize,
	invalidateSession,
	invalidateUser,
	invalidateAllSessions,
	connectSessionSync,

	requireAdmin: (req, res, next) => {
		if (req.decoded?.role === "admin") next()
		else res.status(403).json({ error: "forbidden" })
	}
}