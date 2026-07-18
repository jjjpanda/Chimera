const webhookAlert = require("./webhookAlert.js")
const { getClientIp } = require("request-ip")

const sanitize = (s) => String(s ?? "").replace(/[`@\r\n]/g, " ").slice(0, 256)

const WINDOW = 60 * 1000
const MAX = 30
let count = 0
let windowStart = Date.now()

module.exports = (req, res, next) => {
	if( !req.path.includes("/feed") && !req.path.includes("/shared") && !req.path.includes("/res") ){
		const now = Date.now()
		if (now - windowStart >= WINDOW) {
			windowStart = now
			count = 0
		}
		if (count < MAX) {
			count++
			const ipAddress = getClientIp(req)
			const userAgent = req.headers["user-agent"]
			webhookAlert("```\n" + `${sanitize(req.method)} ${sanitize(req.path)}\nSOURCE: ${ipAddress ? ipAddress : "UNKNOWN"}\nUSER-AGENT: ${sanitize(userAgent)}` + "\n```", "admin")
		}
	}
	next()
}
