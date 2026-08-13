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
		if ((await status()).state !== "idle") return res.status(409).json({ error: true, errors: "UPDATE_IN_PROGRESS" })
		writeJSON(REQUEST, { requestedAt: new Date().toISOString(), requestedBy: req.decoded.username },
			() => res.json({ error: false }),
			(e) => {
				console.error(e)
				res.status(500).json({ error: true })
			})
	} catch (e) {
		console.error(e)
		res.status(500).json({ error: true })
	}
})

app.delete("/update", authorize, requireAdmin, async (req, res) => {
	try {
		if ((await status()).state !== "pending") return res.status(409).json({ error: true, errors: "UPDATE_IN_PROGRESS" })
		fs.unlink(REQUEST, (err) => {
			if (err && err.code !== "ENOENT") {
				console.error(err)
				return res.status(500).json({ error: true })
			}
			res.json({ error: false })
		})
	} catch (e) {
		console.error(e)
		res.status(500).json({ error: true })
	}
})

module.exports = app
