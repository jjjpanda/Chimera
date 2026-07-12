require("dotenv").config()
const { gatewayHost } = require("lib")

const baseUrl = gatewayHost()
const services = ["command", "livestream", "object", "schedule", "storage"]

module.exports = {
	checkUrl: services.reduce((urls, service) => {
		if(process.env[`${service}_PROXY_ON`] == "true"){
			urls[service] = `${baseUrl}/${service}/health`
		}
		return urls
	}, {}),
	webhookUrl: process.env.alert_URL,
	cronString: "*/10 * * * *",
	consoleOutput: true
}
