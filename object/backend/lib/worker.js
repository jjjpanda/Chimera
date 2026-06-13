const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")
const { isPrimeInstance } = require("lib")
const pool = require("./pool.js")
const detector = require("./detector.js")
const sendWebhook = require("./webhook.js")

const INPUT = detector.INPUT
const TEMP_DIR = path.join(process.cwd(), "objectTemp")
fs.mkdirSync(TEMP_DIR, { recursive: true })

const config = {
	confidence: parseFloat(process.env.object_CONFIDENCE) || 0.5,
	intervalMs: parseInt(process.env.object_INTERVAL_MS) || 5000,
	classes: ["person"],
}

const status = {}
const timers = {}

const cameraCount = () => {
	try {
		return JSON.parse(process.env.cameras || "[]").length
	} catch (e) {
		return 0
	}
}

const feedPath = (camera) => path.join(process.env.livestream_FOLDERPATH || "", "feed", String(camera), "video.m3u8")

let scanSeq = 0

const extractFrame = (camera) => new Promise((resolve, reject) => {
	const id = `${camera}-${process.pid}-${scanSeq++}`
	const jpeg = path.join(TEMP_DIR, `${id}.jpg`)
	const raw = path.join(TEMP_DIR, `${id}.raw`)
	const args = [
		"-y", "-loglevel", "error",
		"-i", feedPath(camera),
		"-frames:v", "1", "-q:v", "3", jpeg,
		"-vf", `scale=${INPUT}:${INPUT}:force_original_aspect_ratio=decrease,pad=${INPUT}:${INPUT}:0:0:color=0x727272`,
		"-pix_fmt", "bgr24", "-frames:v", "1", "-f", "rawvideo", raw,
	]
	execFile(process.env.ffmpeg_FILEPATH || "ffmpeg", args, (err) => {
		const cleanup = () => {
			try { fs.unlinkSync(jpeg) } catch (e) {}
			try { fs.unlinkSync(raw) } catch (e) {}
		}
		if (err) {
			cleanup()
			return reject(err)
		}
		try {
			const out = { jpeg: fs.readFileSync(jpeg), raw: fs.readFileSync(raw) }
			cleanup()
			resolve(out)
		} catch (e) {
			cleanup()
			reject(e)
		}
	})
})

const toTensor = (raw) => {
	const size = INPUT * INPUT
	const data = new Float32Array(3 * size)
	for (let i = 0; i < size; i++) {
		data[i] = raw[i * 3]
		data[size + i] = raw[i * 3 + 1]
		data[2 * size + i] = raw[i * 3 + 2]
	}
	return data
}

const roundTo = (val, sig) => Math.round(val * 10 ** sig) / 10 ** sig

const handleDetections = async (camera, detections, jpeg) => {
	for (const d of detections) {
		await pool.query(
			"INSERT INTO objects_detected(camera, type, confidence) VALUES($1, $2, $3)",
			[camera, d.class, roundTo(d.score, 6)]
		).catch((e) => console.log("OBJECT INSERT ERROR", e.message))
	}
	const summary = detections.map((d) => `${d.class} (${Math.round(d.score * 100)}%)`).join(", ")
	await sendWebhook(process.env.alert_URL, `🔍 Camera ${camera}: detected ${summary}`, jpeg)
}

const scan = async (camera) => {
	const st = status[camera] || (status[camera] = {})
	try {
		const { jpeg, raw } = await extractFrame(camera)
		const all = await detector.detect(toTensor(raw), config.confidence)
		const detections = all.filter((d) => config.classes.includes(d.class))
		st.lastRun = new Date().toISOString()
		st.error = null
		if (detections.length) {
			st.lastDetection = { time: st.lastRun, detections }
			await handleDetections(camera, detections, jpeg)
		}
		return detections
	} catch (e) {
		st.error = e.message
		return []
	}
}

const startWorkers = () => {
	if (process.env.object_ON !== "true" || !isPrimeInstance) return
	const count = cameraCount()
	for (let camera = 1; camera <= count; camera++) {
		status[camera] = { running: true, lastRun: null, lastDetection: null, error: null }
		const loop = async () => {
			await scan(camera)
			timers[camera] = setTimeout(loop, config.intervalMs)
		}
		loop()
	}
	console.log(`🔍 Object detection workers started for ${count} camera(s)`)
}

module.exports = {
	startWorkers,
	scan,
	toTensor,
	cameraCount,
	getStatus: () => status,
	getConfig: () => config,
	setConfig: (updates) => {
		if (updates.confidence != null) config.confidence = parseFloat(updates.confidence)
		if (updates.intervalMs != null) config.intervalMs = parseInt(updates.intervalMs)
		if (Array.isArray(updates.classes)) config.classes = updates.classes
		return config
	},
}
