const webhookAlert = require("./webhookAlert.js")

const sanitize = (s) => String(s ?? "").replace(/[`@\r\n]/g, " ").slice(0, 256)

const HIGH_IMPACT = /^\/(authorization\/(login|setup|password|users|sessions)|convert\/(createVideo|createZip|deleteProcess)|file\/(pathDelete|pathClean|pathAutoClean)|task\/(start|stop|destroy))/

const WINDOW = 60 * 1000
const GLOBAL_MAX = 30
const IP_MAX = 10
let globalCount = 0
let windowStart = Date.now()
let ipCounts = new Map()

module.exports = (req, res, next) => {
	if (HIGH_IMPACT.test(req.path)) {
		const now = Date.now()
		if (now - windowStart >= WINDOW) {
			windowStart = now
			globalCount = 0
			ipCounts = new Map()
		}
		const ipAddress = req.ip
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
