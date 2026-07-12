require("dotenv").config()
const { gatewayHost } = require("lib")

const baseUrl = gatewayHost()

module.exports = {
	checkUrl: {
		command: `${baseUrl}/command/health`,
		livestream: `${baseUrl}/livestream/health`,
		object: `${baseUrl}/object/health`,
		schedule: `${baseUrl}/schedule/health`,
		storage: `${baseUrl}/storage/health`
	},
	webhookUrl: process.env.alert_URL,
	cronString: "*/10 * * * *",
	consoleOutput: true
}
