require("dotenv").config()
const { healthChecks } = require("lib")

module.exports = {
	checkUrl: healthChecks(),
	webhookUrl: process.env.alert_URL,
	cronString: "*/10 * * * *",
	consoleOutput: true
}
