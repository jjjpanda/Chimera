const { createHash, timingSafeEqual } = require("crypto")

module.exports = (a, b) => {
	if (typeof a !== "string" || typeof b !== "string") return false
	const digest = (v) => createHash("sha256").update(v).digest()
	return timingSafeEqual(digest(a), digest(b))
}
