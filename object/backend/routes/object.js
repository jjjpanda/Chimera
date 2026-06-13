const express = require("express")
const { auth } = require("lib")
const { requireAdmin } = auth
const pool = require("../lib/pool.js")
const worker = require("../lib/worker.js")

const app = express.Router()

app.get("/status", (req, res) => {
	res.send({ config: worker.getConfig(), cameras: worker.getStatus() })
})

app.get("/config", (req, res) => {
	res.send(worker.getConfig())
})

app.post("/config", requireAdmin, (req, res) => {
	res.send(worker.setConfig(req.body || {}))
})

app.post("/scan", requireAdmin, async (req, res) => {
	const camera = parseInt(req.body && req.body.camera)
	if (!camera) return res.status(400).send({ error: "camera required" })
	res.send({ camera, detections: await worker.scan(camera) })
})

app.get("/detections", async (req, res) => {
	const { camera } = req.query
	const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 500))
	try {
		const result = camera
			? await pool.query("SELECT id, camera, timestamp, type, confidence FROM objects_detected WHERE camera = $1 ORDER BY timestamp DESC LIMIT $2", [camera, limit])
			: await pool.query("SELECT id, camera, timestamp, type, confidence FROM objects_detected ORDER BY timestamp DESC LIMIT $1", [limit])
		res.send(result.rows)
	} catch (e) {
		res.status(500).send({ error: true })
	}
})

module.exports = app
