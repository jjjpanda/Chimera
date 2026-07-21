require("dotenv").config()
const { gatewayHost, readSecret } = require("lib")

const baseUrl = gatewayHost()

module.exports = {
	checkUrl: {
		command: `${baseUrl}/command/health`,
		livestream: `${baseUrl}/livestream/health`,
		object: `${baseUrl}/object/health`,
		schedule: `${baseUrl}/schedule/health`,
		storage: `${baseUrl}/storage/health`
	},
	webhookUrl: readSecret("alert_URL"),
	cronString: "*/10 * * * *",
	consoleOutput: true
}
