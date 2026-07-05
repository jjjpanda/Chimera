var express = require("express")
var path = require("path")
var fs = require("fs")
var { auth, loadCameras, cameraConfFiles, mapLimit } = require("lib")
const { requireAdmin } = auth

const pool = require("../lib/pool")

const app = express.Router()

const FS_CONCURRENCY = 64

const dirFileBytes = async (dir) => {
	const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [])
	const files = entries.filter((entry) => entry.isFile())
	const sizes = await mapLimit(files, FS_CONCURRENCY, async (entry) => {
		const { size } = await fs.promises.stat(path.join(dir, entry.name)).catch(() => ({ size: 0 }))
		return size
	})
	return sizes.reduce((sum, size) => sum + size, 0)
}

const captureBreakdown = async (capturesPath, frameBytes) => {
	let videos = 0, zips = 0, other = 0
	const entries = await fs.promises.readdir(capturesPath, { withFileTypes: true }).catch(() => [])
	const files = entries.filter((entry) => entry.isFile())
	await mapLimit(files, FS_CONCURRENCY, async (entry) => {
		const { size } = await fs.promises.stat(path.join(capturesPath, entry.name)).catch(() => ({ size: 0 }))
		if (entry.name.endsWith(".mp4")) videos += size
		else if (entry.name.endsWith(".zip")) zips += size
		else other += size
	})
	const objects = await dirFileBytes(path.join(process.env.storage_FOLDERPATH || process.cwd(), "objectCaptures"))
	return { frames: frameBytes, videos, zips, objects, other }
}

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
				"SELECT id, timestamp, name, size FROM frame_files WHERE camera = $1 AND timestamp >= ($2::date AT TIME ZONE 'UTC') AND timestamp < (($2::date + INTERVAL '1 day') AT TIME ZONE 'UTC') ORDER BY timestamp DESC LIMIT $3 OFFSET $4",
				[camera_id, date, per_page, offset]
			),
			pool.query(
				"SELECT COUNT(*) FROM frame_files WHERE camera = $1 AND timestamp >= ($2::date AT TIME ZONE 'UTC') AND timestamp < (($2::date + INTERVAL '1 day') AT TIME ZONE 'UTC')",
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
	if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes("..")) return res.status(400).json({ error: "invalid filename" })
	const capturesBase = path.join(process.env.storage_FOLDERPATH, "shared/captures")
	const filePath = path.join(capturesBase, camera_id, filename)
	res.sendFile(filePath, (err) => {
		if (err && !res.headersSent) res.status(404).json({ error: "not found" })
	})
})

app.get("/usage", async (req, res) => {
	try {
		const capturesPath = path.join(process.env.storage_FOLDERPATH, "shared/captures")
		const maxGb = parseFloat(process.env.storage_MAX_GB) || 0
		const cameras = loadCameras()

		const { rows: statRows } = await pool.query(
			"SELECT camera, COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM frame_files GROUP BY camera"
		)
		const countByCamera = new Map(statRows.map(r => [String(r.camera), parseInt(r.count) || 0]))
		const bytesByCamera = new Map(statRows.map(r => [String(r.camera), parseInt(r.bytes) || 0]))
		const totalFrames = statRows.reduce((sum, r) => sum + (parseInt(r.count) || 0), 0)
		const frameBytes = statRows.reduce((sum, r) => sum + (parseInt(r.bytes) || 0), 0)

		const cameraStats = cameras.map(({ id, name }) => ({
			id,
			name,
			used_gb: (bytesByCamera.get(String(id)) || 0) / 1e9,
			frame_count: countByCamera.get(String(id)) || 0
		}))

		const breakdown = await captureBreakdown(capturesPath, frameBytes)

		res.json({
			used_gb: parseFloat(((frameBytes + breakdown.videos + breakdown.zips + breakdown.other + breakdown.objects) / 1e9).toFixed(3)),
			max_gb: maxGb,
			cameras: cameraStats,
			total_frames: totalFrames,
			breakdown
		})
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.delete("/camera/:id", requireAdmin, async (req, res) => {
	const { id } = req.params
	if (!/^\d+$/.test(id)) return res.status(400).json({ error: "invalid id" })
	const camPath = path.join(process.env.storage_FOLDERPATH, "shared/captures", id)
	const objectsPath = path.join(process.env.storage_FOLDERPATH || process.cwd(), "objectCaptures")
	try {
		await fs.promises.rm(camPath, { recursive: true, force: true })
		const objectFiles = await fs.promises.readdir(objectsPath).catch(() => [])
		await Promise.all(
			objectFiles
				.filter((f) => f.startsWith(`${id}-`))
				.map((f) => fs.promises.unlink(path.join(objectsPath, f)).catch(() => {}))
		)
		await pool.query("DELETE FROM frame_files WHERE camera = $1", [id])
		await pool.query("DELETE FROM objects_detected WHERE camera = $1", [id])
		for (const file of cameraConfFiles(id)) {
			await fs.promises.unlink(file).catch((e) => {
				if (e.code !== "ENOENT") console.log(`STORAGE: failed to remove ${path.basename(file)}; camera may resurrect on reload`, e.message)
			})
		}
		res.json({ deleted: true })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

module.exports = app
