const gatewayHost = require("./gatewayHost.js")
const trustProxyHops = require("./trustProxyHops.js")

const DEFAULT_SECURE_PORT = "443"

// Where the HTTPS redirect sends an http:// visitor, in one place. gateway.js redirects here and
// preflight checks the same value against gateway_HOST, so the two cannot drift apart.
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
