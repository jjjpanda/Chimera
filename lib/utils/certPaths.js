const gatewayHost = require("./gatewayHost.js")

const letsencryptPaths = (hostname) => ({
	key: `/etc/letsencrypt/live/${hostname}/privkey.pem`,
	cert: `/etc/letsencrypt/live/${hostname}/fullchain.pem`,
})

const certPaths = () => {
	let hostname = ""
	try {
		const hostStr = gatewayHost()
		if (hostStr) hostname = new URL(hostStr).hostname
	} catch (e) {
		console.error("Invalid gateway_HOST:", e.message)
	}
	if (hostname.startsWith("[")) {
		console.error("Cannot auto-resolve a certificate for the IP literal gateway_HOST:", hostname, "— Let's Encrypt issues for domain names only. Set privateKey_FILEPATH and certificate_FILEPATH instead.")
		hostname = ""
	}
	const keyOverride = process.env.privateKey_FILEPATH
	const certOverride = process.env.certificate_FILEPATH
	if ((keyOverride && !certOverride) || (!keyOverride && certOverride)) {
		console.error("⚠️ HTTPS misconfigured: privateKey_FILEPATH and certificate_FILEPATH must both be set, or neither.")
		return { key: "", cert: "" }
	}
	const auto = hostname ? letsencryptPaths(hostname) : { key: "", cert: "" }
	return { key: keyOverride || auto.key, cert: certOverride || auto.cert }
}

certPaths.letsencryptPaths = letsencryptPaths
module.exports = certPaths
