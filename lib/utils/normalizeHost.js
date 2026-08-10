const net = require("net")

const split = (host) => {
	const h = (host || "").trim().replace(/\/+$/, "")
	const scheme = /^https?:\/\//i.exec(h)?.[0]
	return { scheme, rest: scheme ? h.slice(scheme.length) : h }
}

const bareIPv6 = (host) => net.isIPv6(split(host).rest)

const normalizeHost = (host) => {
	const { scheme, rest } = split(host)
	if (!rest || net.isIPv6(rest)) return ""
	return `${scheme || "https://"}${rest}`
}

normalizeHost.bareIPv6 = bareIPv6
module.exports = normalizeHost
