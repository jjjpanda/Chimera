const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")
const { isPrimeInstance, objectState, loadCameras } = require("lib")
const pool = require("./pool.js")
const detector = require("./detector.js")
const sendWebhook = require("./webhook.js")

const INPUT = detector.INPUT
const TEMP_DIR = path.join(process.cwd(), "objectTemp")
const CAPTURES_DIR = path.join(process.env.storage_FOLDERPATH || process.cwd(), "objectCaptures")
const MAX_CAPTURES = Number.isFinite(parseInt(process.env.object_MAX_CAPTURES)) ? parseInt(process.env.object_MAX_CAPTURES) : 500
const PRUNE_INTERVAL_MS = parseInt(process.env.object_PRUNE_INTERVAL_MS) > 0 ? parseInt(process.env.object_PRUNE_INTERVAL_MS) : 300000
fs.mkdirSync(TEMP_DIR, { recursive: true })
fs.mkdirSync(CAPTURES_DIR, { recursive: true })

const confTier = (conf) => conf == null ? 0 : conf < 0.6 ? 1 : conf < 0.7 ? 2 : conf < 0.8 ? 3 : conf < 0.9 ? 4 : 5

const pruneCaptures = async () => {
	const names = fs.readdirSync(CAPTURES_DIR)
	if (names.length <= MAX_CAPTURES) return
	const files = names.map((f) => ({ f, t: fs.statSync(path.join(CAPTURES_DIR, f)).mtimeMs }))

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
	confidence: Number.isFinite(parseFloat(process.env.object_CONFIDENCE)) ? parseFloat(process.env.object_CONFIDENCE) : 0.5,
	intervalMs: parseInt(process.env.object_INTERVAL_MS) || 5000,
	classes: ["person", "car", "bird", "dog", "cat", "truck", "bus", "motorcycle", "umbrella", "bicycle"],
}

const status = {}
const timers = {}
let pruneTimer = null
let workersRunning = false
let _cameras = null

const cameras = () => _cameras || (_cameras = loadCameras().map(cam => ({ id: cam.id, name: cam.name })))

const feedPath = (feed) => path.join(process.env.livestream_FOLDERPATH || "", "feed", String(feed), "video.m3u8")

let scanSeq = 0

const extractFrame = (feed) => new Promise((resolve, reject) => {
	const id = `${feed}-${process.pid}-${scanSeq++}`
	const jpeg = path.join(TEMP_DIR, `${id}.jpg`)
	const raw = path.join(TEMP_DIR, `${id}.raw`)
	const vf = `scale=${INPUT}:${INPUT}:force_original_aspect_ratio=decrease,pad=${INPUT}:${INPUT}:0:0:color=0x727272`
	const args = [
		"-y", "-loglevel", "error",
		"-i", feedPath(feed),
		"-vf", vf, "-frames:v", "1", "-q:v", "3", jpeg,
		"-vf", vf, "-pix_fmt", "bgr24", "-frames:v", "1", "-f", "rawvideo", raw,
	]
	execFile(process.env.ffmpeg_FILEPATH || "ffmpeg", args, { timeout: 30000, killSignal: "SIGKILL" }, (err) => {
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
	if (process.env.object_ALERT_ON === "false") return
	const summary = detections.map((d) => `${d.class} (${Math.round(d.score * 100)}%)`).join(", ")
	await sendWebhook(process.env.alert_URL, `🔍 Camera ${camera}: detected ${summary}`, jpeg)
}

const scan = async (id) => {
	const cam = cameras().find(c => c.id === id)
	if (!cam) return []
	const st = status[id] || (status[id] = {})
	try {
		const { jpeg, raw } = await extractFrame(cam.id)
		const all = await detector.detect(toTensor(raw), config.confidence)
		const detections = all.filter((d) => config.classes.includes(d.class))
		st.lastRun = new Date().toISOString()
		st.error = null
		if (detections.length) {
			st.lastDetection = { time: st.lastRun, detections }
			await handleDetections(id, detections, jpeg)
		}
		return detections
	} catch (e) {
		st.error = e.message
		return []
	}
}

const startWorkers = () => {
	if (process.env.object_ON !== "true" || !isPrimeInstance) return
	workersRunning = true
	_cameras = null
	const list = cameras()
	for (const cam of list) {
		status[cam.id] = { running: true, lastRun: null, lastDetection: null, error: null }
		const loop = async () => {
			await scan(cam.id)
			if (workersRunning) timers[cam.id] = setTimeout(loop, config.intervalMs)
		}
		loop()
	}
	pruneTimer = setInterval(() => pruneCaptures().catch(() => {}), PRUNE_INTERVAL_MS)
	console.log(`🔍 Object detection workers started for ${list.length} camera(s)`)
}

const stopWorkers = () => {
	workersRunning = false
	_cameras = null
	clearInterval(pruneTimer)
	pruneTimer = null
	for (const camera of Object.keys(timers)) {
		clearTimeout(timers[camera])
		delete timers[camera]
	}
	for (const camera of Object.keys(status)) {
		status[camera].running = false
	}
}

module.exports = {
	startWorkers,
	stopWorkers,
	pruneCaptures,
	scan,
	toTensor,
	cameras,
	CAPTURES_DIR,
	MAX_CAPTURES,
	getStatus: () => status,
	getConfig: () => config,
	setConfig: (updates) => {
		if (updates.confidence != null) {
			const c = parseFloat(updates.confidence)
			if (Number.isFinite(c) && c >= 0 && c <= 1) config.confidence = c
		}
		if (updates.intervalMs != null) {
			const ms = parseInt(updates.intervalMs)
			if (Number.isFinite(ms)) config.intervalMs = Math.min(Math.max(1000, ms), 86400000)
		}
		if (Array.isArray(updates.classes)) config.classes = updates.classes
		return config
	},
}

objectState.register({
	getConfig: () => config,
	getStatus: () => status,
	setConfig: module.exports.setConfig,
	scan: module.exports.scan
})
