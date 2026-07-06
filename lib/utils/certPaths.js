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
	const key = process.env.privateKey_FILEPATH || (base ? `${base}/privkey.pem` : "")
	const cert = process.env.certificate_FILEPATH || (base ? `${base}/fullchain.pem` : "")
	if ((key && !cert) || (!key && cert)) {
		console.error("⚠️ HTTPS misconfigured: Both private key and certificate paths must be resolvable.")
	}
	return { key, cert }
}
