const releaseOnSuccess = (res, release) =>
	res.on("finish", () => { if (res.statusCode < 400 || res.statusCode >= 500) release() })

module.exports = (namespace) => {
	const memory = require("memory")
	const sharedAttempts = process.env.memory_ON == "true"
	const client = sharedAttempts ? memory.client(namespace) : null

	const defaultKeyFn = (req) => `${req.ip || ""}:${req.path}`

	const makeReserve = ({ windowMs, max, keyFn }) => {
		const local = memory.loginAttempts()
		const getKey = keyFn || defaultKeyFn
		const reserveLocal = (key, cb) =>
			local.loginReserve(key, max, windowMs, (blocked) => cb(blocked, () => local.loginRelease(key)))
		const reserve = (key, cb) => {
			if (!sharedAttempts || !client.connected) return reserveLocal(key, cb)
			client.timeout(1000).emit("loginReserve", key, max, windowMs, (err, blocked) => {
				if (err) return reserveLocal(key, cb)
				cb(blocked, () => client.emit("loginRelease", key))
			})
		}
		return (req, cb) => reserve(getKey(req), cb)
	}

	const rateLimit = (opts) => {
		const { throttleMs, skip, keyFn } = opts
		const getKey = keyFn || defaultKeyFn
		const budget = makeReserve(opts)
		const throttle = throttleMs && makeReserve({ windowMs: throttleMs, max: 1, keyFn: (req) => `throttle:${getKey(req)}` })
		const tooMany = (res) => res.status(429).json({ error: true, errors: "TOO_MANY_ATTEMPTS" })
		const gate = (req, res, next) => budget(req, (blocked, release) => {
			req.throttled ||= blocked
			if (!blocked) {
				if (opts.releaseOnSuccess) releaseOnSuccess(res, release)
				return next()
			}
			if (!throttle) return tooMany(res)
			// no releaseOnSuccess: a throttled request never charged the budget, so releasing it would refund a guess it never spent
			throttle(req, (tooSoon) => tooSoon ? tooMany(res) : next())
		})
		return skip ? (req, res, next) => skip(req).then((s) => (s ? next() : gate(req, res, next)), () => gate(req, res, next)) : gate
	}

	return { rateLimit, client }
}
