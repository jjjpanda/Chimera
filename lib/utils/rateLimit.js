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

	const tooMany = (res) => res.status(429).json({ error: true, errors: "Too many attempts" })

	const rateLimitChain = (optsList) => {
		const parts = optsList.map((opts) => {
			const getKey = opts.keyFn || defaultKeyFn
			return {
				opts,
				budget: makeReserve(opts),
				throttle: opts.throttleMs && makeReserve({ windowMs: opts.throttleMs, max: 1, keyFn: (req) => `throttle:${getKey(req)}` }),
			}
		})
		const anySkip = parts.some((p) => p.opts.skip)

		const reserveAll = (req, skips, done) => {
			const results = []
			const live = parts.map((_, i) => i).filter((i) => !skips[i])
			let pending = live.length
			if (!pending) return done(results)
			live.forEach((i) => {
				parts[i].budget(req, (blocked, release) => {
					results[i] = { blocked, release }
					if (--pending === 0) done(results)
				})
			})
		}

		const decide = (req, res, next, results) => {
			const releaseFrom = (from) => {
				for (let i = from; i < results.length; i++) {
					const result = results[i]
					if (result && !result.blocked && !result.released) {
						result.released = true
						result.release()
					}
				}
			}
			const step = (i) => {
				if (i >= parts.length) return next()
				const result = results[i]
				if (!result) return step(i + 1)
				req.throttled ||= result.blocked
				if (!result.blocked) {
					if (!result.released && parts[i].opts.releaseOnSuccess) releaseOnSuccess(res, result.release)
					return step(i + 1)
				}
				const refuse = () => { releaseFrom(0); tooMany(res) }
				if (!parts[i].throttle) return refuse()
				parts[i].throttle(req, (tooSoon) => {
					if (tooSoon) return refuse()
					releaseFrom(i + 1)
					step(i + 1)
				})
			}
			step(0)
		}

		const run = (req, res, next, skips) => reserveAll(req, skips, (results) => decide(req, res, next, results))

		return (req, res, next) => {
			if (!anySkip) return run(req, res, next, [])
			Promise.all(parts.map((p) => (p.opts.skip ? p.opts.skip(req).then(Boolean, () => false) : false)))
				.then((skips) => run(req, res, next, skips))
		}
	}

	return { rateLimit: (opts) => rateLimitChain([opts]), rateLimitChain, client }
}
