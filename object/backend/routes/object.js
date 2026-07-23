const express = require("express")
const { auth, isPrimeInstance } = require("lib")
const { requireAdmin } = auth
const pool = require("../lib/pool.js")
const worker = require("../lib/worker.js")

const app = express.Router()

const cameraNames = async () => Object.fromEntries((await worker.cameras()).map(c => [c.id, c.name]))

const ifPrime = (res, handler) =>
	isPrimeInstance ? handler() : res.status(503).send({ error: "state unavailable" })

app.use("/captures", express.static(worker.CAPTURES_DIR))

app.get("/status", (req, res) => ifPrime(res, async () => {
	try {
		res.send({ config: worker.getConfig(), cameras: worker.getStatus(), cameraNames: await cameraNames() })
	} catch (e) {
		res.status(500).send({ error: true })
	}
}))

app.get("/config", (req, res) => ifPrime(res, () => res.send(worker.getConfig())))

app.post("/config", requireAdmin, (req, res) => ifPrime(res, () =>
	res.send(worker.setConfig(req.body || {}))))

app.post("/scan", requireAdmin, (req, res) => {
	const camera = parseInt(req.body && req.body.camera)
	if (!camera) return res.status(400).send({ error: "camera required" })
	ifPrime(res, () =>
		worker.scan(camera).then(detections => res.send({ camera, detections }))
			.catch(e => { console.error(e); res.status(e.code === "UNKNOWN_CAMERA" ? 404 : 502).send({ error: true }) }))
})

app.get("/detections", async (req, res) => {
	const { camera, start, end } = req.query
	const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 500))
	const where = []
	const params = []
	if (camera) {
		const id = parseInt(camera)
		if (!(id > 0)) return res.status(400).send({ error: "unknown camera" })
		params.push(id); where.push(`camera = $${params.length}`)
	}
	if (start) {
		if (isNaN(Date.parse(start))) return res.status(400).send({ error: "invalid start" })
		params.push(start); where.push(`timestamp >= $${params.length}`)
	}
	if (end) {
		if (isNaN(Date.parse(end))) return res.status(400).send({ error: "invalid end" })
		params.push(end); where.push(`timestamp <= $${params.length}`)
	}
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
