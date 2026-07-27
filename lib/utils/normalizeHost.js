module.exports = (host) => {
	const h = (host || "").trim().replace(/\/+$/, "")
	if (!h) return ""
	return /^https?:\/\//i.test(h) ? h : `https://${h}`
}
