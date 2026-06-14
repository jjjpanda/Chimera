const express = require("express")
const { auth } = require("lib")
const { requireAdmin } = auth
const pool = require("../lib/pool.js")
const worker = require("../lib/worker.js")

const app = express.Router()

app.use("/captures", express.static(worker.CAPTURES_DIR))

app.get("/status", (req, res) => {
	res.send({ config: worker.getConfig(), cameras: worker.getStatus(), cameraNames: worker.getCameraNames() })
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
	const { camera, start, end } = req.query
	const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 500))
	const where = []
	const params = []
	if (camera) { params.push(camera); where.push(`camera = $${params.length}`) }
	if (start) { params.push(start); where.push(`timestamp >= $${params.length}`) }
	if (end) { params.push(end); where.push(`timestamp <= $${params.length}`) }
	params.push(limit)
	const clause = where.length ? `WHERE ${where.join(" AND ")} ` : ""
	try {
		const result = await pool.query(
			`SELECT id, camera, timestamp, type, confidence, box, image FROM objects_detected ${clause}ORDER BY timestamp DESC LIMIT $${params.length}`,
			params
		)
		res.send(result.rows)
	} catch (e) {
		res.status(500).send({ error: true })
	}
})

module.exports = app
