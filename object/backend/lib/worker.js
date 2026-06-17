const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")
const { isPrimeInstance } = require("lib")
const pool = require("./pool.js")
const detector = require("./detector.js")
const sendWebhook = require("./webhook.js")

const INPUT = detector.INPUT
const TEMP_DIR = path.join(process.cwd(), "objectTemp")
const CAPTURES_DIR = path.join(process.cwd(), "objectCaptures")
const MAX_CAPTURES = parseInt(process.env.object_MAX_CAPTURES) || 500
fs.mkdirSync(TEMP_DIR, { recursive: true })
fs.mkdirSync(CAPTURES_DIR, { recursive: true })

const confTier = (conf) => conf == null ? 0 : conf < 0.6 ? 1 : conf < 0.7 ? 2 : conf < 0.8 ? 3 : conf < 0.9 ? 4 : 5

const pruneCaptures = async () => {
	const files = fs.readdirSync(CAPTURES_DIR)
		.map((f) => ({ f, t: fs.statSync(path.join(CAPTURES_DIR, f)).mtimeMs }))
	if (files.length <= MAX_CAPTURES) return

	const { rows } = await pool.query(
		"SELECT image, MAX(confidence) AS confidence FROM objects_detected WHERE image = ANY($1) GROUP BY image",
		[files.map((f) => f.f)]
	).catch(() => ({ rows: [] }))

	const confMap = Object.fromEntries(rows.map((r) => [r.image, parseFloat(r.confidence)]))
	files.sort((a, b) => {
		const td = confTier(confMap[a.f]) - confTier(confMap[b.f])
		return td !== 0 ? td : a.t - b.t
	})
	const removed = files.slice(0, files.length - MAX_CAPTURES)
	for (const { f } of removed) {
		try { fs.unlinkSync(path.join(CAPTURES_DIR, f)) } catch (e) {}
	}
	if (removed.length) {
		await pool.query("DELETE FROM objects_detected WHERE image = ANY($1)", [removed.map((x) => x.f)]).catch(() => {})
	}
}

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

const getCameraNames = () => {
	try {
		return JSON.parse(process.env.cameras || "[]")
	} catch (e) {
		return []
	}
}

const feedPath = (camera) => path.join(process.env.livestream_FOLDERPATH || "", "feed", String(camera), "video.m3u8")

let scanSeq = 0

const extractFrame = (camera) => new Promise((resolve, reject) => {
	const id = `${camera}-${process.pid}-${scanSeq++}`
	const jpeg = path.join(TEMP_DIR, `${id}.jpg`)
	const raw = path.join(TEMP_DIR, `${id}.raw`)
	const vf = `scale=${INPUT}:${INPUT}:force_original_aspect_ratio=decrease,pad=${INPUT}:${INPUT}:0:0:color=0x727272`
	const args = [
		"-y", "-loglevel", "error",
		"-i", feedPath(camera),
		"-vf", vf, "-frames:v", "1", "-q:v", "3", jpeg,
		"-vf", vf, "-pix_fmt", "bgr24", "-frames:v", "1", "-f", "rawvideo", raw,
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
	const image = `${camera}-${Date.now()}.jpg`
	try { fs.writeFileSync(path.join(CAPTURES_DIR, image), jpeg) } catch (e) {}
	for (const d of detections) {
		await pool.query(
			"INSERT INTO objects_detected(camera, type, confidence, box, image) VALUES($1, $2, $3, $4, $5)",
			[camera, d.class, roundTo(d.score, 6), JSON.stringify(d.box.map((n) => roundTo(n, 1))), image]
		).catch((e) => console.log("OBJECT INSERT ERROR", e.message))
	}
	await pruneCaptures().catch(() => {})
	if (process.env.object_ALERT_ON === "false") return
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
	getCameraNames,
	CAPTURES_DIR,
	getStatus: () => status,
	getConfig: () => config,
	setConfig: (updates) => {
		if (updates.confidence != null) {
			const c = parseFloat(updates.confidence)
			if (Number.isFinite(c) && c >= 0 && c <= 1) config.confidence = c
		}
		if (updates.intervalMs != null) {
			const ms = parseInt(updates.intervalMs)
			if (Number.isFinite(ms)) config.intervalMs = Math.max(1000, ms)
		}
		if (Array.isArray(updates.classes)) config.classes = updates.classes
		return config
	},
}
