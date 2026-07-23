module.exports = (key) => {
	const host = (process.env[key] || "").trim().replace(/\/+$/, "")
	if (!host) return ""
	return /^https?:\/\//i.test(host) ? host : `https://${host}`
}
