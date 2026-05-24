var express = require("express")
var path = require("path")
var fs = require("fs")
var { execFile } = require("child_process")
var { auth, loadCameras } = require("lib")
const { requireAdmin } = auth

const pool = require("../lib/pool")

const app = express.Router()

app.get("/events", async (req, res) => {
	const { camera_id, date } = req.query
	const per_page = Math.max(1, Math.min(parseInt(req.query.per_page) || 100, 1000))
	const page = Math.max(1, parseInt(req.query.page) || 1)
	if (!camera_id || !date) return res.status(400).json({ error: "camera_id and date required" })
	if (!/^\d+$/.test(camera_id)) return res.status(400).json({ error: "camera_id must be numeric" })
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "invalid date" })
	try {
		const offset = (page - 1) * per_page
		const [dataResult, countResult] = await Promise.all([
			pool.query(
				"SELECT id, timestamp, name, size FROM frame_files WHERE camera = $1 AND DATE(timestamp) = $2 ORDER BY timestamp DESC LIMIT $3 OFFSET $4",
				[camera_id, date, per_page, offset]
			),
			pool.query(
				"SELECT COUNT(*) FROM frame_files WHERE camera = $1 AND DATE(timestamp) = $2",
				[camera_id, date]
			)
		])
		res.json({
			events: dataResult.rows,
			total: parseInt(countResult.rows[0].count),
			page: parseInt(page),
			per_page
		})
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.get("/frames/:camera_id/:filename", (req, res) => {
	const { camera_id, filename } = req.params
	if (!/^\d+$/.test(camera_id)) return res.status(400).json({ error: "camera_id must be numeric" })
	if (!/^[A-Za-z0-9._-]+$/.test(filename)) return res.status(400).json({ error: "invalid filename" })
	const capturesBase = path.join(process.env.storage_FOLDERPATH, "shared/captures")
	const filePath = path.join(capturesBase, camera_id, filename)
	res.sendFile(filePath, (err) => {
		if (err && !res.headersSent) res.status(404).json({ error: "not found" })
	})
})

app.get("/usage", requireAdmin, async (req, res) => {
	try {
		const capturesPath = path.join(process.env.storage_FOLDERPATH, "shared/captures")
		const maxGb = parseFloat(process.env.storage_MAX_GB) || 0
		const cameras = loadCameras()

		const duBytes = await new Promise((resolve) => {
			execFile('du', ['-sb', capturesPath], (err, stdout) => {
				if (err) return resolve(0)
				resolve(parseInt(stdout.split("\t")[0]) || 0)
			})
		})

		const cameraStats = await Promise.all(
			cameras.map(async ({ id, name }) => {
				const camPath = path.join(capturesPath, id.toString())
				const [countResult, duResult] = await Promise.all([
					pool.query("SELECT COUNT(*) FROM frame_files WHERE camera = $1", [id]),
					new Promise(resolve => execFile('du', ['-sb', camPath], (err, stdout) => {
						resolve(err ? 0 : parseInt(stdout.split("\t")[0]) || 0)
					}))
				])
				return {
					id,
					name,
					used_gb: parseFloat((duResult / 1e9).toFixed(3)),
					frame_count: parseInt(countResult.rows[0].count) || 0
				}
			})
		)

		const totalFrames = await pool.query("SELECT COUNT(*) FROM frame_files")

		res.json({
			used_gb: parseFloat((duBytes / 1e9).toFixed(3)),
			max_gb: maxGb,
			cameras: cameraStats,
			total_frames: parseInt(totalFrames.rows[0].count) || 0
		})
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.delete("/camera/:id", requireAdmin, async (req, res) => {
	const { id } = req.params
	if (!/^\d+$/.test(id)) return res.status(400).json({ error: "invalid id" })
	const camPath = path.join(process.env.storage_FOLDERPATH, "shared/captures", id)
	try {
		await fs.promises.rm(camPath, { recursive: true, force: true })
		await pool.query("DELETE FROM frame_files WHERE camera = $1", [id])
		res.json({ deleted: true })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

module.exports = app
