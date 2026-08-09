const gatewayHost = require("./gatewayHost.js")
const trustProxyHops = require("./trustProxyHops.js")

const DEFAULT_SECURE_PORT = "443"

const redirectTarget = ({
	host = gatewayHost(),
	securePort = process.env.gateway_PORT_SECURE || DEFAULT_SECURE_PORT,
	trustProxy = trustProxyHops() > 0,
} = {}) => {
	try {
		const url = new URL(host)
		if (url.protocol == "https:" && url.port) return url.host
		const suffix = trustProxy || String(securePort) == DEFAULT_SECURE_PORT ? "" : `:${securePort}`
		return `${url.hostname}${suffix}`
	}
	catch {
		return ""
	}
}

redirectTarget.DEFAULT_SECURE_PORT = DEFAULT_SECURE_PORT
module.exports = redirectTarget
