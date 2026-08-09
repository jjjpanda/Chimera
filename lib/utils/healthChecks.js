const gatewayHost = require("./gatewayHost.js")

const SERVICES = ["command", "livestream", "object", "schedule", "storage"]

module.exports =({ localOnly = false } = {}) => {
	const baseUrl = gatewayHost()
	return Object.fromEntries(SERVICES
		.filter(s => process.env[`${s}_PROXY_ON`] === "true" && (!localOnly || process.env[`${s}_ON`] === "true"))
		.map(s => [s, `${baseUrl}/${s}/health`]))
}
