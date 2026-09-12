var express    = require("express")
var fs = require("fs")
var pm2 = require("pm2")
const { subprocess, auth, loadCameras, cameraConfFiles } = require("lib")
const { requireAdmin } = auth

const app = express.Router()

subprocess.checkProcess("motion", () => {
	console.log("▶ Motion process detected ✅")
}, () => {
	console.log("▶ Motion server needs a motion process ⚠️")
})

app.get("/status", (req, res, next) => {
	req.processName = "motion"
	next()
}, subprocess.processListMiddleware)

const THRESHOLD_LINE = /^\s*threshold\s+(\S+)/m

const restartMotion = () => new Promise((resolve) => pm2.restart("motion", (err) => {
	if (err) console.log("STORAGE: motion restart failed after sensitivity change", err.message || err)
	resolve(!err)
}))

const getGlobalThreshold = async () => {
	const text = await fs.promises.readFile(process.env.storage_MOTION_CONF_FILEPATH, "utf8")
	const match = text.match(THRESHOLD_LINE)
	if (!match) throw new Error("threshold not found in motion.conf")
	return parseInt(match[1], 10)
}

app.get("/sensitivity", async (req, res) => {
	try {
		const defaultThreshold = await getGlobalThreshold()
		let cameras = []
		try {
			const loaded = await loadCameras()
			cameras = await Promise.all(loaded.map(async (cam) => {
				try {
					const confFiles = await cameraConfFiles(cam.id)
					if (confFiles.length) {
						const text = await fs.promises.readFile(confFiles[0], "utf8")
						const match = text.match(THRESHOLD_LINE)
						if (match) {
							return { id: cam.id, name: cam.name, threshold: parseInt(match[1], 10), isCustom: true }
						}
					}
				} catch (err) {
					console.warn(`STORAGE: failed reading conf for camera ${cam.id}:`, err.message || err)
				}
				return { id: cam.id, name: cam.name, threshold: defaultThreshold, isCustom: false }
			}))
		} catch (e) {
			cameras = []
		}
		res.json({ threshold: defaultThreshold, defaultThreshold, cameras })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.get("/sensitivity/:id", async (req, res) => {
	const { id } = req.params
	if (!/^\d+$/.test(id)) return res.status(400).json({ error: "invalid camera id" })
	try {
		const defaultThreshold = await getGlobalThreshold()
		const confFiles = await cameraConfFiles(id)
		if (!confFiles.length) return res.status(404).json({ error: "camera not found" })
		const text = await fs.promises.readFile(confFiles[0], "utf8")
		const match = text.match(THRESHOLD_LINE)
		if (match) {
			return res.json({ id: parseInt(id, 10), threshold: parseInt(match[1], 10), defaultThreshold, isCustom: true })
		}
		res.json({ id: parseInt(id, 10), threshold: defaultThreshold, defaultThreshold, isCustom: false })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.put("/sensitivity", requireAdmin, async (req, res) => {
	const threshold = req.body?.threshold
	if (!Number.isInteger(threshold) || threshold < 1) {
		return res.status(400).json({ error: "threshold must be an integer >= 1" })
	}
	const confPath = process.env.storage_MOTION_CONF_FILEPATH
	try {
		const text = await fs.promises.readFile(confPath, "utf8")
		if (!THRESHOLD_LINE.test(text)) return res.status(500).json({ error: "threshold not found in motion.conf" })
		// Written directly in-place to preserve Docker single-file bind mount inode
		await fs.promises.writeFile(confPath, text.replace(THRESHOLD_LINE, `threshold ${threshold}`))
		const motionRestarted = await restartMotion()
		res.status(motionRestarted ? 200 : 502).json({ threshold, motionRestarted })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.put("/sensitivity/:id", requireAdmin, async (req, res) => {
	const { id } = req.params
	if (!/^\d+$/.test(id)) return res.status(400).json({ error: "invalid camera id" })
	const { threshold, reset } = req.body || {}
	const isReset = reset === true || threshold === null
	if (!isReset && (!Number.isInteger(threshold) || threshold < 1)) {
		return res.status(400).json({ error: "threshold must be an integer >= 1 or reset must be true" })
	}
	try {
		const confFiles = await cameraConfFiles(id)
		if (!confFiles.length) return res.status(404).json({ error: "camera not found" })
		for (const file of confFiles) {
			let text = await fs.promises.readFile(file, "utf8")
			if (isReset) {
				text = text.replace(/^\s*threshold\s+\S+\r?\n?/gm, "")
			} else if (THRESHOLD_LINE.test(text)) {
				text = text.replace(THRESHOLD_LINE, `threshold ${threshold}`)
			} else {
				text = text.trimEnd() + `\nthreshold ${threshold}\n`
			}
			await fs.promises.writeFile(file, text, "utf8")
		}
		const motionRestarted = await restartMotion()
		const defaultThreshold = await getGlobalThreshold().catch(() => null)
		res.status(motionRestarted ? 200 : 502).json({
			id: parseInt(id, 10),
			threshold: isReset ? defaultThreshold : threshold,
			isCustom: !isReset,
			motionRestarted
		})
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

module.exports = app
