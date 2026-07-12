require("dotenv").config()
const { gatewayHost } = require("lib")
const { enabledServices } = require("./lib/utils/heartbeatServices")

const baseUrl = gatewayHost()
const enabled = enabledServices()

const checkUrl = Object.fromEntries(
	enabled.map(name => [name, `${baseUrl}/${name}/health`])
)

module.exports = {
	checkUrl,
	webhookUrl: process.env.alert_URL,
	cronString: "*/10 * * * *",
	consoleOutput: true
}
