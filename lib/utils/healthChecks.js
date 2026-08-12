const gatewayHost = require("./gatewayHost.js")
const parsePort = require("./parsePort.js")

const SERVICES = ["command", "livestream", "object", "schedule", "storage"]
const HEALTH_PATHS = new Set(SERVICES.map(s => `/${s}/health`))

const loopbackHost = () => {
	const port = parsePort(process.env.gateway_PORT)
	return port ? `http://127.0.0.1:${port}` : ""
}

const healthChecks = ({ localOnly = false, base = gatewayHost() } = {}) =>
	Object.fromEntries(SERVICES
		.filter(s => process.env[`${s}_PROXY_ON`] === "true" && (!localOnly || process.env[`${s}_ON`] === "true"))
		.map(s => [s, `${base}/${s}/health`]))

const isHealthPath = (path) => HEALTH_PATHS.has(path)

module.exports = { healthChecks, loopbackHost, isHealthPath }
