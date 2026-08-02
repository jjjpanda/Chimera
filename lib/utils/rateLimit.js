const releaseOnSuccess = (res, release) =>
	res.on("finish", () => { if (res.statusCode < 400 || res.statusCode >= 500) release() })

module.exports = (namespace) => {
	const memory = require("memory")
	const sharedAttempts = process.env.memory_ON == "true"
	const client = sharedAttempts ? memory.client(namespace) : null

	const makeReserve = ({ windowMs, max, keyFn }) => {
		const local = memory.loginAttempts()
		const getKey = keyFn || ((req) => `${req.ip || ""}:${req.path}`)
		const reserveLocal = (key, cb) =>
			local.loginReserve(key, max, windowMs, (blocked) => cb(blocked, () => local.loginRelease(key)))
		const reserve = (key, cb) => {
			if (!sharedAttempts || !client.connected) return reserveLocal(key, cb)
			client.timeout(1000).emit("loginReserve", key, max, windowMs, (err, blocked) => {
				if (err) {
					client.emit("loginRelease", key)
					return reserveLocal(key, cb)
				}
				cb(blocked, () => client.emit("loginRelease", key))
			})
		}
		return (req, cb) => reserve(getKey(req), cb)
	}

	const rateLimit = (opts) => {
		const reserve = makeReserve(opts)
		return (req, res, next) => {
			reserve(req, (blocked, release) => {
				if (blocked) return res.status(429).json({ error: true, errors: "Too many attempts" })
				if (opts.releaseOnSuccess) releaseOnSuccess(res, release)
				next()
			})
		}
	}

	return { makeReserve, rateLimit, releaseOnSuccess, client }
}
