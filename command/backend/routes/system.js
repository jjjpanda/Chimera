var express = require("express")
const fs = require("fs")
const { auth, updateBridge, jsonFileHanding } = require("lib")
const { requireAdmin } = auth
const { REQUEST, RUNNING, RESULT } = updateBridge
const { readJSON, writeJSON } = jsonFileHanding
const { pool } = require("./lib/auth.js")

const authorize = auth.createAuthorize(pool)

const app = express.Router()

const read = (file) => new Promise(resolve => readJSON(file, (err, data) => resolve(err ? null : data)))

const status = async () => {
	const [running, request, last] = await Promise.all([read(RUNNING), read(REQUEST), read(RESULT)])
	const active = running ?? request
	return {
		state: running ? "running" : request ? "pending" : "idle",
		requestedAt: active?.requestedAt ?? null,
		requestedBy: active?.requestedBy ?? null,
		last: last ?? null
	}
}

let queue = Promise.resolve()
const serialized = (fn) => {
	const run = queue.then(fn, fn)
	queue = run.catch(() => {})
	return run
}

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
			if ((await status()).state !== "idle") return res.status(409).json({ error: true, errors: "UPDATE_IN_PROGRESS" })
			await new Promise((resolve, reject) =>
				writeJSON(REQUEST, { requestedAt: new Date().toISOString(), requestedBy: req.decoded.username }, resolve, reject))
			res.json({ error: false })
		})
	} catch (e) {
		console.error(e)
		res.status(500).json({ error: true })
	}
})

app.delete("/update", authorize, requireAdmin, async (req, res) => {
	try {
		await serialized(async () => {
			if ((await status()).state === "running") return res.status(409).json({ error: true, errors: "UPDATE_IN_PROGRESS" })
			await new Promise((resolve, reject) =>
				fs.unlink(REQUEST, (err) => err && err.code !== "ENOENT" ? reject(err) : resolve()))
			res.json({ error: false })
		})
	} catch (e) {
		console.error(e)
		res.status(500).json({ error: true })
	}
})

module.exports = app
