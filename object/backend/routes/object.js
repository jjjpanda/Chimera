const express = require("express")
const { auth, isPrimeInstance } = require("lib")
const { requireAdmin } = auth
const pool = require("../lib/pool.js")
const worker = require("../lib/worker.js")

const app = express.Router()

const sharedState = process.env.memory_ON === "true"
const stateClient = sharedState ? require("memory").client("OBJECT") : null

const fallback = (res, local) =>
	isPrimeInstance ? local() : res.status(503).send({ error: "state unavailable" })

app.use("/captures", express.static(worker.CAPTURES_DIR))

app.get("/status", (req, res) => {
	const local = () => res.send({ config: worker.getConfig(), cameras: worker.getStatus(), cameraNames: worker.getCameraNames() })
	if (stateClient && stateClient.connected) {
		stateClient.timeout(1000).emit("objectGetState", (err, state) =>
			err ? fallback(res, local) : res.send({ config: state.config, cameras: state.status, cameraNames: worker.getCameraNames() }))
	} else fallback(res, local)
})

app.get("/config", (req, res) => {
	const local = () => res.send(worker.getConfig())
	if (stateClient && stateClient.connected) {
		stateClient.timeout(1000).emit("objectGetState", (err, state) =>
			err ? fallback(res, local) : res.send(state.config))
	} else fallback(res, local)
})

app.post("/config", requireAdmin, (req, res) => {
	const body = req.body || {}
	const local = () => res.send(worker.setConfig(body))
	if (stateClient && stateClient.connected) {
		stateClient.timeout(1000).emit("objectSetConfig", body, (err, config) =>
			err ? fallback(res, local) : res.send(config))
	} else fallback(res, local)
})

app.post("/scan", requireAdmin, (req, res) => {
	const camera = parseInt(req.body && req.body.camera)
	if (!camera) return res.status(400).send({ error: "camera required" })
	const local = () => worker.scan(camera).then(detections => res.send({ camera, detections }))
	if (stateClient && stateClient.connected) {
		stateClient.timeout(35000).emit("objectScan", camera, (err, detections) =>
			err ? fallback(res, local) : res.send({ camera, detections }))
	} else fallback(res, local)
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
