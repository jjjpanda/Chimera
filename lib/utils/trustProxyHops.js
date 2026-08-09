const clean = (val) => (val || "").trim()

const trustProxyHops = (val = process.env.gateway_TRUST_PROXY) => {
	const v = clean(val)
	if (v === "true") return 1
	return /^\d+$/.test(v) ? Number(v) : 0
}

trustProxyHops.validTrustProxy = (val) => {
	const v = clean(val)
	return v === "true" || v === "false" || /^\d+$/.test(v)
}
module.exports = trustProxyHops
