const fs = require("fs")
const net = require("net")
const gatewayHost = require("./gatewayHost.js")

const letsencryptPaths = (hostname) => ({
	key: `/etc/letsencrypt/live/${hostname}/privkey.pem`,
	cert: `/etc/letsencrypt/live/${hostname}/fullchain.pem`,
})

const isIpLiteral = (hostname) => net.isIP((hostname || "").replace(/^\[|\]$/g, "")) !== 0

const isFile = (p) => { try { return fs.statSync(p).isFile() } catch { return false } }

const certPaths = () => {
	let hostname = ""
	try {
		const hostStr = gatewayHost()
		if (hostStr) hostname = new URL(hostStr).hostname
	} catch (e) {
		console.error("Invalid gateway_HOST:", e.message)
	}
	const keyOverride = process.env.privateKey_FILEPATH
	const certOverride = process.env.certificate_FILEPATH
	if ((keyOverride && !certOverride) || (!keyOverride && certOverride)) {
		console.error("⚠️ HTTPS misconfigured: privateKey_FILEPATH and certificate_FILEPATH must both be set, or neither.")
		return { key: "", cert: "" }
	}
	// The overrides answer the question, so the IP-literal complaint below must not run first —
	// an operator who has already set both was told to set them on every gateway start.
	if (keyOverride && certOverride) return { key: keyOverride, cert: certOverride }
	if (!hostname) return { key: "", cert: "" }
	const auto = letsencryptPaths(hostname)
	if (isIpLiteral(hostname) && !(isFile(auto.key) && isFile(auto.cert))) {
		console.error("Cannot auto-resolve a certificate for the IP literal gateway_HOST:", hostname, "— Let's Encrypt issues for domain names only. Set privateKey_FILEPATH and certificate_FILEPATH instead.")
		return { key: "", cert: "" }
	}
	return auto
}

certPaths.letsencryptPaths = letsencryptPaths
certPaths.isIpLiteral = isIpLiteral
certPaths.isFile = isFile
module.exports = certPaths
