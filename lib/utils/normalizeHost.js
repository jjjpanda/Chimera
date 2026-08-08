module.exports = (host) => {
	const h = (host || "").trim().replace(/\/+$/, "")
	if (!h) return ""
	const withScheme = /^https?:\/\//i.test(h) ? h : `https://${h}`
	try { new URL(withScheme); return withScheme } catch { /* a bare IPv6 literal needs brackets before it parses */ }
	return withScheme.replace(/^(https?:\/\/)([0-9a-f:]*:[0-9a-f:]*)$/i, "$1[$2]")
}
