module.exports = (host) => {
	const h = (host || "").trim().replace(/\/+$/, "")
	if (!h) return ""
	const withScheme = /^https?:\/\//i.test(h) ? h : `https://${h}`
	// new URL() throws on a bare IPv6 literal, so bracket an authority that holds more than one colon
	return withScheme.replace(/^(https?:\/\/)([^/[]*:[^/]*:[^/]*)$/i, "$1[$2]")
}
