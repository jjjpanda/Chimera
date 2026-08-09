const net = require("net")

const split = (host) => {
	const h = (host || "").trim().replace(/\/+$/, "")
	const scheme = /^https?:\/\//i.exec(h)?.[0]
	return { scheme, rest: scheme ? h.slice(scheme.length) : h }
}

// "::1:8443" is a valid eight-group address and it is also how someone writes [::1] port 8443.
// Bracketing it picked one reading and sent every visitor to an address nobody serves. There is
// no way to tell the two apart, so an unbracketed IPv6 is refused and new URL() fails loudly.
const bareIPv6 = (host) => net.isIPv6(split(host).rest)

const normalizeHost = (host) => {
	const { scheme, rest } = split(host)
	if (!rest || net.isIPv6(rest)) return ""
	return `${scheme || "https://"}${rest}`
}

normalizeHost.bareIPv6 = bareIPv6
module.exports = normalizeHost
