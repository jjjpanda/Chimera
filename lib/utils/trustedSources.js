const proxyAddr = require("proxy-addr")

const compileTrustedSources = (sources) => {
	const list = ((sources || "").trim() || "loopback").split(",").map((s) => s.trim()).filter(Boolean)
	if (!list.length) throw new TypeError("no trusted sources")
	return proxyAddr.compile(list)
}

const validTrustedSources = (sources) => {
	try {
		compileTrustedSources(sources)
		return true
	} catch (e) {
		return false
	}
}

module.exports = { compileTrustedSources, validTrustedSources }
