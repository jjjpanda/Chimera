module.exports = () => {
	const host = (process.env.storage_HOST || "").trim()
	if (!host) return ""
	return /^https?:\/\//i.test(host) ? host : `http://${host}`
}
