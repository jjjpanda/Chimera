var express = require("express")
const memory = require("memory")
const { auth, updateBridge, jsonFileHanding } = require("lib")
const { requireAdmin } = auth
const { REQUEST, RUNNING, RESULT, VERSION, bumpKind } = updateBridge
const { version: running } = require("../../../package.json")
const { readJSON, writeJSON } = jsonFileHanding
const { pool } = require("./lib/auth.js")

const authorize = auth.createAuthorize(pool)

const app = express.Router()

const read = (file) => new Promise(resolve => readJSON(file, (err, data) => resolve(err ? null : data)))

const versions = async () => {
	const published = await read(VERSION)
	const pair = { current: published?.current ?? running, available: published?.available ?? null }
	return { ...pair, checkedAt: published?.at ?? null, bump: bumpKind(pair) }
}

const watchdogEnabled = () => process.env.watchdog_ON === "true"

const status = async () => {
	const [marker, request, last, version] = await Promise.all([read(RUNNING), read(REQUEST), read(RESULT), versions()])
	const active = marker ?? request
	return {
		state: marker ? "running" : request ? "pending" : "idle",
		requestedAt: active?.requestedAt ?? null,
		requestedBy: active?.requestedBy ?? null,
		last: last ?? null,
		version,
		watchdogEnabled: watchdogEnabled()
	}
}

let queue = Promise.resolve()
const serialized = (fn) => {
	const run = queue.then(fn, fn)
	queue = run.catch(() => {})
	return run
}

// `queue` above is per worker, and pm2 cluster mode runs several, so the shared mutex is what
// keeps the read-then-write on REQUEST atomic across them — falling back to `queue` alone when
// memory is unreachable, as lib/utils/rateLimit.js does.
const LOCK_KEY = "system-update"
const LOCK_TTL_MS = 10000
const sharedLock = process.env.memory_ON === "true"
const lockClient = sharedLock ? memory.client("SYSTEM_UPDATE") : null
const unlocked = () => {}

const acquireLock = () => new Promise((resolve) => {
	if (!sharedLock || !lockClient.connected) return resolve(unlocked)
	lockClient.timeout(1000).emit("loginReserve", LOCK_KEY, 1, LOCK_TTL_MS, (err, blocked) => {
		resolve(err ? unlocked : blocked ? null : () => lockClient.emit("loginRelease", LOCK_KEY))
	})
})

app.get("/update", authorize, requireAdmin, async (req, res) => {
	try {
		res.json({ error: false, ...await status() })
	} catch (e) {
		console.error(e)
		res.status(500).json({ error: true })
	}
})

app.post("/update", authorize, requireAdmin, async (req, res) => {
	try {
		if (!watchdogEnabled()) return res.status(409).json({ error: true, errors: "WATCHDOG_DISABLED" })
		await serialized(async () => {
			const release = await acquireLock()
			if (!release) return res.status(409).json({ error: true, errors: "UPDATE_IN_PROGRESS" })
			try {
				if ((await status()).state !== "idle") return res.status(409).json({ error: true, errors: "UPDATE_IN_PROGRESS" })
				await new Promise((resolve, reject) =>
					writeJSON(REQUEST, { requestedAt: new Date().toISOString(), requestedBy: req.decoded.username, allowMajor: req.body?.allowMajor === true }, resolve, reject))
				res.json({ error: false })
			} finally {
				release()
			}
		})
	} catch (e) {
		console.error(e)
		res.status(500).json({ error: true })
	}
})

module.exports = app
