var express    = require("express")
var fs = require("fs")
var pm2 = require("pm2")
const { subprocess, auth } = require("lib")
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

const THRESHOLD_LINE = /^threshold\s+(\S+)/m

const restartMotion = () => new Promise((resolve) => pm2.restart("motion", (err) => {
	if (err) console.log("STORAGE: motion restart failed after sensitivity change", err.message || err)
	resolve(!err)
}))

app.get("/sensitivity", async (req, res) => {
	try {
		const text = await fs.promises.readFile(process.env.storage_MOTION_CONF_FILEPATH, "utf8")
		const match = text.match(THRESHOLD_LINE)
		if (!match) return res.status(500).json({ error: "threshold not found in motion.conf" })
		res.json({ threshold: parseInt(match[1]) })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

app.put("/sensitivity", requireAdmin, async (req, res) => {
	const { threshold } = req.body
	if (!Number.isInteger(threshold) || threshold < 1) {
		return res.status(400).json({ error: "threshold must be an integer >= 1" })
	}
	try {
		const text = await fs.promises.readFile(process.env.storage_MOTION_CONF_FILEPATH, "utf8")
		if (!THRESHOLD_LINE.test(text)) return res.status(500).json({ error: "threshold not found in motion.conf" })
		await fs.promises.writeFile(process.env.storage_MOTION_CONF_FILEPATH, text.replace(THRESHOLD_LINE, `threshold ${threshold}`))
		const motionRestarted = await restartMotion()
		res.status(motionRestarted ? 200 : 502).json({ threshold, motionRestarted })
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

module.exports = app
