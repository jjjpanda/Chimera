const webhookAlert = require("./webhookAlert.js")
const { getClientIp } = require("request-ip")

module.exports = (req, res, next) => {
	if( !req.path.includes("/feed") && !req.path.includes("/shared") && !req.path.includes("/res") ){
		const ipAddress = getClientIp(req)
		const userAgent = req.headers["user-agent"]
		webhookAlert(`\n${req.method} ${req.path}\nSOURCE: ${ipAddress ? ipAddress : "UNKNOWN"}\nUSER-AGENT: ${userAgent}`, "admin")
	}
	next()
}