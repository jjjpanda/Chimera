var express = require("express")
const fs = require("fs")
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

const status = async () => {
	const [marker, request, last, version] = await Promise.all([read(RUNNING), read(REQUEST), read(RESULT), versions()])
	const active = marker ?? request
	return {
		state: marker ? "running" : request ? "pending" : "idle",
		requestedAt: active?.requestedAt ?? null,
		requestedBy: active?.requestedBy ?? null,
		last: last ?? null,
		version
	}
}

let queue = Promise.resolve()
const serialized = (fn) => {
	const run = queue.then(fn, fn)
	queue = run.catch(() => {})
	return run
}

// pm2 cluster mode (chimeraInstances > 1) runs multiple `command` workers, each with its own
// `queue` above, so that in-process lock alone can't keep the read-then-write on REQUEST/RUNNING
// atomic across workers. When memory_ON, borrow the same loginReserve/loginRelease primitive
// lib/utils/rateLimit.js uses for cross-instance coordination, as a short-lived mutex.
const LOCK_KEY = "system-update"
const LOCK_TTL_MS = 10000
const sharedLock = process.env.memory_ON === "true"
const lockClient = sharedLock ? memory.client("SYSTEM_UPDATE") : null

const acquireLock = () => new Promise((resolve) => {
	if (!sharedLock) return resolve(() => {})
	if (!lockClient.connected) return resolve(null)
	lockClient.timeout(1000).emit("loginReserve", LOCK_KEY, 1, LOCK_TTL_MS, (err, blocked) => {
		resolve(err || blocked ? null : () => lockClient.emit("loginRelease", LOCK_KEY))
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

app.delete("/update", authorize, requireAdmin, async (req, res) => {
	try {
		await serialized(async () => {
			const release = await acquireLock()
			if (!release) return res.status(409).json({ error: true, errors: "UPDATE_IN_PROGRESS" })
			try {
				await new Promise((resolve, reject) =>
					fs.unlink(REQUEST, (err) => err && err.code !== "ENOENT" ? reject(err) : resolve()))
				if ((await status()).state === "running") return res.status(409).json({ error: true, errors: "UPDATE_IN_PROGRESS" })
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
