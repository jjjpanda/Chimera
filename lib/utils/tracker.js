const webhookAlert = require("./webhookAlert.js")
const { getClientIp } = require("request-ip")

const sanitize = (s) => String(s ?? "").replace(/[`@\r\n]/g, " ").slice(0, 256)

const WINDOW = 60 * 1000
const MAX = 30
const MAX_KEYS = 1000
const buckets = new Map()

module.exports = (req, res, next) => {
	if( !req.path.includes("/feed") && !req.path.includes("/shared") && !req.path.includes("/res") ){
		const now = Date.now()
		const ip = getClientIp(req) || "UNKNOWN"
		let bucket = buckets.get(ip)
		if (!bucket || now - bucket.windowStart >= WINDOW) {
			if (!bucket && buckets.size >= MAX_KEYS) {
				for (const [key, b] of buckets) if (now - b.windowStart >= WINDOW) buckets.delete(key)
				if (buckets.size >= MAX_KEYS) buckets.delete(buckets.keys().next().value)
			}
			bucket = { windowStart: now, count: 0 }
			buckets.set(ip, bucket)
		}
		bucket.count++
		if (bucket.count <= MAX) {
			const userAgent = req.headers["user-agent"]
			webhookAlert("```\n" + `${sanitize(req.method)} ${sanitize(req.path)}\nSOURCE: ${sanitize(ip)}\nUSER-AGENT: ${sanitize(userAgent)}` + "\n```", "admin")
		} else if (bucket.count === MAX + 1) {
			webhookAlert("```\n" + `further alerts from ${sanitize(ip)} suppressed for this window` + "\n```", "admin")
		}
	}
	next()
}
