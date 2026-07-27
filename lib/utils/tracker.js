const webhookAlert = require("./webhookAlert.js")

const sanitize = (s) => String(s ?? "").replace(/[`@\r\n]/g, " ").slice(0, 256)

const HIGH_IMPACT = /^\/(authorization\/(login|setup|password|users|sessions)|camera\/[^/]+|convert\/(createVideo|createZip|cancelProcess|deleteProcess)|file\/(pathDelete|pathClean|pathAutoClean)|livestream\/restart|object\/(config|scan)|task\/(start|stop|destroy))(\/|$)/
const READ_ONLY_LIST = /^\/(authorization\/users(\/[^/]+\/sessions)?|object\/config)$/
const BROWSER_PROBED = /^\/(favicon\.ico|robots\.txt|sitemap\.xml|apple-touch-icon(-\d+x\d+)?(-precomposed)?\.png)$/
const MOUNTED = /^\/$|^\/(\.well-known|admin|assets|authorization|camera|cameras|captures|clip|command|convert|database|events|feed|file|frames|index\.html|live|livestream|login|memory|motion|object|objects|recordings|res|schedule|shared|stats|storage|task|usage)(\/|$)/

const TIERS = [
	(req) => HIGH_IMPACT.test(req.path) && !(req.method === "GET" && READ_ONLY_LIST.test(req.path)),
	(req) => !MOUNTED.test(req.path) && !BROWSER_PROBED.test(req.path)
]

const WINDOW = 60 * 1000
const GLOBAL_MAX = 30
const IP_MAX = 10
const freshBudgets = () => TIERS.map(() => ({ globalCount: 0, ipCounts: new Map() }))
let budgets = freshBudgets()
let windowStart = Date.now()

module.exports = (req, res, next) => {
	const tier = TIERS.findIndex((matches) => matches(req))
	if (tier !== -1) {
		const now = Date.now()
		if (now - windowStart >= WINDOW) {
			windowStart = now
			budgets = freshBudgets()
		}
		const budget = budgets[tier]
		const ipAddress = req.ip
		const ipKey = ipAddress || "UNKNOWN"
		const ipCount = budget.ipCounts.get(ipKey) || 0
		if (budget.globalCount < GLOBAL_MAX && ipCount < IP_MAX) {
			budget.globalCount++
			budget.ipCounts.set(ipKey, ipCount + 1)
			const userAgent = req.headers["user-agent"]
			webhookAlert("```\n" + `${sanitize(req.method)} ${sanitize(req.path)}\nSOURCE: ${ipAddress ? sanitize(ipAddress) : "UNKNOWN"}\nUSER-AGENT: ${sanitize(userAgent)}` + "\n```", "admin")
		}
	}
	next()
}
