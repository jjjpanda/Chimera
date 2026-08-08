module.exports = (host) => {
	const h = (host || "").trim().replace(/\/+$/, "")
	if (!h) return ""
	const withScheme = /^https?:\/\//i.test(h) ? h : `https://${h}`
	return withScheme.replace(/^(https?:\/\/)([^/[]*:[^/]*:[^/]*)$/i, "$1[$2]")
}
