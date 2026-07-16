module.exports = () => {
	const host = (process.env.gateway_HOST || "").trim()
	if (!host) return ""
	return /^https?:\/\//i.test(host) ? host : `https://${host}`
}
