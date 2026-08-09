// gateway_TRUST_PROXY says how many proxies sit in front: "true" is one, "false" or unset is
// none, a number is that many. The count picks which X-Forwarded-* entry to believe — the one
// the outermost trusted hop wrote. Anything unrecognised reads as none, which trusts nothing.
module.exports = (val = process.env.gateway_TRUST_PROXY) => {
	const v = (val || "").trim()
	if (v === "true") return 1
	return /^\d+$/.test(v) ? Number(v) : 0
}
