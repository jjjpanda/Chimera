const webhookAlert = require("./webhookAlert.js")
const { getClientIp } = require("request-ip")

const sanitize = (s) => String(s ?? "").replace(/[`@\r\n]/g, " ").slice(0, 256)

const WINDOW = 60 * 1000
const GLOBAL_MAX = 30
const IP_MAX = 10
let globalCount = 0
let windowStart = Date.now()
let ipCounts = new Map()

module.exports = (req, res, next) => {
	if( !req.path.includes("/feed") && !req.path.includes("/shared") && !req.path.includes("/res") ){
		const now = Date.now()
		if (now - windowStart >= WINDOW) {
			windowStart = now
			globalCount = 0
			ipCounts = new Map()
		}
		const ipAddress = getClientIp(req)
		const ipKey = ipAddress || "UNKNOWN"
		const ipCount = ipCounts.get(ipKey) || 0
		if (globalCount < GLOBAL_MAX && ipCount < IP_MAX) {
			globalCount++
			ipCounts.set(ipKey, ipCount + 1)
			const userAgent = req.headers["user-agent"]
			webhookAlert("```\n" + `${sanitize(req.method)} ${sanitize(req.path)}\nSOURCE: ${ipAddress ? sanitize(ipAddress) : "UNKNOWN"}\nUSER-AGENT: ${sanitize(userAgent)}` + "\n```", "admin")
		}
	}
	next()
}
