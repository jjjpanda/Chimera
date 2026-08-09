const net = require("net")

module.exports = (host) => {
	const h = (host || "").trim().replace(/\/+$/, "")
	if (!h) return ""
	const scheme = /^https?:\/\//i.exec(h)?.[0]
	const rest = scheme ? h.slice(scheme.length) : h
	return `${scheme || "https://"}${net.isIPv6(rest) ? `[${rest}]` : rest}`
}
