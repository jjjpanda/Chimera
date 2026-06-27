const express = require("express")
const { auth, isPrimeInstance } = require("lib")
const { requireAdmin } = auth
const pool = require("../lib/pool.js")
const worker = require("../lib/worker.js")

const app = express.Router()

const sharedState = process.env.memory_ON === "true"
const stateClient = sharedState ? require("memory").client("OBJECT") : null

const cameraNames = () => Object.fromEntries(worker.cameras().map(c => [c.id, c.name]))

const fallback = (res, local) =>
	isPrimeInstance ? local() : res.status(503).send({ error: "state unavailable" })

const withState = (res, { timeout = 1000, event, args = [], onState, local, rerunOnTimeout = true }) => {
	if (stateClient && stateClient.connected) {
		stateClient.timeout(timeout).emit(event, ...args, (err, result) =>
			err ? (rerunOnTimeout ? fallback(res, local) : res.status(504).send({ error: "scan timed out" })) : onState(result))
	} else fallback(res, local)
}

app.use("/captures", express.static(worker.CAPTURES_DIR))

app.get("/status", (req, res) => withState(res, {
	event: "objectGetState",
	onState: state => res.send({ config: state.config, cameras: state.status, cameraNames: cameraNames() }),
	local: () => res.send({ config: worker.getConfig(), cameras: worker.getStatus(), cameraNames: cameraNames() })
}))

app.get("/config", (req, res) => withState(res, {
	event: "objectGetState",
	onState: state => res.send(state.config),
	local: () => res.send(worker.getConfig())
}))

app.post("/config", requireAdmin, (req, res) => {
	const body = req.body || {}
	withState(res, {
		event: "objectSetConfig",
		args: [body],
		onState: config => res.send(config),
		local: () => res.send(worker.setConfig(body))
	})
})

app.post("/scan", requireAdmin, (req, res) => {
	const camera = parseInt(req.body && req.body.camera)
	if (!camera) return res.status(400).send({ error: "camera required" })
	withState(res, {
		timeout: 35000,
		rerunOnTimeout: false,
		event: "objectScan",
		args: [camera],
		onState: detections => res.send({ camera, detections }),
		local: () => worker.scan(camera).then(detections => res.send({ camera, detections }))
	})
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
