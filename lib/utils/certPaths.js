module.exports = () => {
	let base = ""
	try {
		let hostStr = process.env.gateway_HOST
		if (hostStr) {
			if (!/^https?:\/\//i.test(hostStr)) hostStr = "https://" + hostStr
			base = `/etc/letsencrypt/live/${new URL(hostStr).hostname}`
		}
	} catch (e) {
		console.error("Invalid gateway_HOST:", e.message)
	}
	const keyOverride = process.env.privateKey_FILEPATH
	const certOverride = process.env.certificate_FILEPATH
	if ((keyOverride && !certOverride) || (!keyOverride && certOverride)) {
		console.error("⚠️ HTTPS misconfigured: privateKey_FILEPATH and certificate_FILEPATH must both be set, or neither.")
		return { key: "", cert: "" }
	}
	const key = keyOverride || (base ? `${base}/privkey.pem` : "")
	const cert = certOverride || (base ? `${base}/fullchain.pem` : "")
	return { key, cert }
}
