const releaseOnSuccess = (res, release) =>
	res.on("finish", () => { if (res.statusCode < 400 || res.statusCode >= 500) release() })

module.exports = (namespace) => {
	const memory = require("memory")
	const sharedAttempts = process.env.memory_ON == "true"
	const client = sharedAttempts ? memory.client(namespace) : null

	const defaultKeyFn = (req) => `${req.ip || ""}:${req.path}`

	// One store per limiter. A shared store lets the buckets evict each other: a flood of
	// per-account keys would drop the flooder's own per-IP counter and hand them a fresh budget.
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

	// Chained limiters, one round-trip. Every budget is reserved at once instead of one after
	// the other, so a shared-memory deploy waits on one timeout rather than three stacked ones.
	// The decision still walks the list in order, and a refusal releases the reservations the
	// serial version would never have made.
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
			let pending = 0
			let issued = false
			const settle = () => { if (issued && pending === 0) done(results) }
			parts.forEach((part, i) => {
				if (skips[i]) return
				pending++
				part.budget(req, (blocked, release) => {
					results[i] = { blocked, release }
					pending--
					settle()
				})
			})
			issued = true
			settle()
		}

		const decide = (req, res, next, results) => {
			const releaseFrom = (from) => {
				for (let i = from; i < results.length; i++) if (results[i] && !results[i].blocked) results[i].release()
			}
			const step = (i) => {
				if (i >= parts.length) return next()
				const result = results[i]
				if (!result) return step(i + 1)
				req.throttled ||= result.blocked
				if (!result.blocked) {
					if (parts[i].opts.releaseOnSuccess) releaseOnSuccess(res, result.release)
					return step(i + 1)
				}
				const refuse = () => { releaseFrom(i + 1); tooMany(res) }
				if (!parts[i].throttle) return refuse()
				parts[i].throttle(req, (tooSoon) => tooSoon ? refuse() : step(i + 1))
			}
			step(0)
		}

		const run = (req, res, next, skips) => reserveAll(req, skips, (results) => decide(req, res, next, results))

		return (req, res, next) => {
			if (!anySkip) return run(req, res, next, [])
			const skips = []
			let pending = parts.length
			const settle = () => { if (--pending === 0) run(req, res, next, skips) }
			parts.forEach((part, i) => {
				if (!part.opts.skip) return settle()
				part.opts.skip(req).then((s) => { skips[i] = !!s }, () => {}).then(settle)
			})
		}
	}

	return { rateLimit: (opts) => rateLimitChain([opts]), rateLimitChain, client }
}
