const proxyAddr = require("proxy-addr")

const compileTrustedSources = (sources) =>
	proxyAddr.compile((sources || "loopback").split(",").map((s) => s.trim()).filter(Boolean))

const validTrustedSources = (sources) => {
	try {
		compileTrustedSources(sources)
		return true
	} catch (e) {
		return false
	}
}

module.exports = { compileTrustedSources, validTrustedSources }
