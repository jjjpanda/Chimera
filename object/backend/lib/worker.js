const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")
const { isPrimeInstance, loadCameras, mapLimit, webhookAlert } = require("lib")
const pool = require("./pool.js")
const detector = require("./detector.js")
const sendWebhook = require("./webhook.js")

const INPUT = detector.INPUT
const TEMP_DIR = path.join(process.cwd(), "objectTemp")
const CAPTURES_DIR = path.join(process.env.storage_FOLDERPATH || process.cwd(), "objectCaptures")
const MAX_CAPTURES = Number.isFinite(parseInt(process.env.object_MAX_CAPTURES)) ? Math.max(0, parseInt(process.env.object_MAX_CAPTURES)) : 500
const PRUNE_INTERVAL_MS = parseInt(process.env.object_PRUNE_INTERVAL_MS) > 0 ? parseInt(process.env.object_PRUNE_INTERVAL_MS) : 300000
const PRUNE_CONCURRENCY = 32
const CAMERA_TTL_MS = 30000
const TEMP_STALE_MS = 60000
fs.mkdirSync(TEMP_DIR, { recursive: true })
try { fs.mkdirSync(CAPTURES_DIR, { recursive: true }) } catch (e) { console.error("❌ Failed to create object captures directory:", e.message) }

const confTier = (conf) => conf == null ? 0 : conf < 0.6 ? 1 : conf < 0.7 ? 2 : conf < 0.8 ? 3 : conf < 0.9 ? 4 : 5

const sweepTemp = async () => {
	const names = await fs.promises.readdir(TEMP_DIR).catch(() => [])
	const cutoff = Date.now() - TEMP_STALE_MS
	await mapLimit(names, PRUNE_CONCURRENCY, async (f) => {
		const p = path.join(TEMP_DIR, f)
		try {
			const stat = await fs.promises.stat(p)
			if (stat.mtimeMs < cutoff) await fs.promises.unlink(p)
		} catch (e) {}
	})
}

sweepTemp().catch(() => {})

const pruneCaptures = async () => {
	if (MAX_CAPTURES <= 0) return
	const names = await fs.promises.readdir(CAPTURES_DIR)
	if (names.length <= MAX_CAPTURES) return
	const stats = await mapLimit(names, PRUNE_CONCURRENCY, async (f) => {
		try { return { f, t: (await fs.promises.stat(path.join(CAPTURES_DIR, f))).mtimeMs } } catch (e) { return null }
	})
	const files = stats.filter(Boolean)
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
	await mapLimit(removed, PRUNE_CONCURRENCY, async ({ f }) => {
		try { await fs.promises.unlink(path.join(CAPTURES_DIR, f)) } catch (e) {}
	})
	if (removed.length) {
		await pool.query("DELETE FROM objects_detected WHERE image = ANY($1)", [removed.map((x) => x.f)]).catch(() => {})
	}
}

const parseConfidence = (val) => {
	const c = parseFloat(val)
	return Number.isFinite(c) && c >= 0 && c <= 1 ? c : 0.5
}

const config = {
	confidence: parseConfidence(process.env.object_CONFIDENCE),
	intervalMs: parseInt(process.env.object_INTERVAL_MS) || 5000,
	classes: ["person", "car", "bird", "dog", "cat", "truck", "bus", "motorcycle", "umbrella", "bicycle"],
}

const status = {}
const timers = {}
const inFlight = new Set()
let pruneTimer = null
let reconcileTimer = null
let epoch = 0
let _cameras = null
let _camerasAt = 0

const cameras = async (reload = false) => {
	if (reload || Date.now() - _camerasAt >= CAMERA_TTL_MS) {
		_cameras = (await loadCameras()).map(cam => ({ id: cam.id, name: cam.name }))
		_camerasAt = Date.now()
	}
	return _cameras
}

const gone = (id, era) => era !== epoch || !_cameras || !_cameras.some((c) => c.id === id)

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

let captureWriteFailing = false

const handleDetections = async (camera, detections, jpeg, era) => {
	const image = `${camera}-${Date.now()}.jpg`
	const stored = await fs.promises.writeFile(path.join(CAPTURES_DIR, image), jpeg)
		.then(() => true)
		.catch((e) => {
			console.log("OBJECT CAPTURE WRITE ERROR", e.message)
			if (!captureWriteFailing) {
				captureWriteFailing = true
				webhookAlert(`⚠️ Object capture write to ${CAPTURES_DIR} failed (${e.message}) — detections are still being alerted but no longer recorded. Check disk space.`, "admin")
			}
			return false
		})
	if (stored) captureWriteFailing = false
	if (gone(camera, era)) return
	const persistable = stored ? detections.filter((d) => Array.isArray(d.box)) : []
	if (persistable.length) {
		const values = []
		const rows = persistable.map((d, i) => {
			const p = i * 5
			values.push(camera, d.class, roundTo(d.score, 6), JSON.stringify(d.box.map((n) => roundTo(n, 1))), image)
			return `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5})`
		})
		await pool.query(
			`INSERT INTO objects_detected(camera, type, confidence, box, image) VALUES ${rows.join(", ")}`,
			values
		).catch((e) => console.log("OBJECT INSERT ERROR", e.message))
	}
	if (process.env.object_ALERT_ON === "false") return
	const summary = detections.map((d) => `${d.class} (${Math.round(d.score * 100)}%)`).join(", ")
	await sendWebhook(process.env.alert_URL, `🔍 Camera ${camera}: detected ${summary}`, jpeg)
}

const scan = async (id, era = epoch) => {
	try {
		const list = await cameras()
		const cam = list.find(c => c.id === id)
		if (!cam) {
			const err = new Error("unknown camera")
			err.code = "UNKNOWN_CAMERA"
			throw err
		}
		const { jpeg, raw } = await extractFrame(cam.id)
		const all = await detector.detect(toTensor(raw), config.confidence)
		const detections = all.filter((d) => config.classes.includes(d.class))

		if (detections.length && era === epoch) await cameras(true).catch(() => {})
		if (gone(id, era)) return detections

		const st = status[id] || (status[id] = {})
		st.lastRun = new Date().toISOString()
		st.error = null
		if (detections.length) {
			st.lastDetection = { time: st.lastRun, detections }
			await handleDetections(id, detections, jpeg, era)
		}
		return detections
	} catch (e) {
		if (status[id]) status[id].error = e.message
		throw e
	}
}

const timeout = (ms) => new Promise((_, reject) => {
	setTimeout(() => reject(new Error("scan timeout")), ms).unref()
})

const startLoop = (id, era) => {
	const st = status[id]
	const loop = async () => {
		// cap a scan so a hung query can't stall the loop, and skip re-launching while the prior scan is still outstanding so a permanent hang can't pile up concurrent scans
		if (!inFlight.has(id)) {
			inFlight.add(id)
			const done = scan(id, era).finally(() => inFlight.delete(id))
			await Promise.race([done, timeout(config.intervalMs * 6)]).catch(() => {})
		}
		if (era !== epoch || status[id] !== st || !st.running) return
		timers[id] = setTimeout(loop, config.intervalMs)
	}
	loop()
}

const reconcile = async (era) => {
	const active = await cameras(true).catch(() => null)
	if (era !== epoch || !active) return
	const ids = new Set(active.map((c) => c.id))
	for (const cam of active) {
		if (status[cam.id] && status[cam.id].running) continue
		status[cam.id] = { running: true, lastRun: null, lastDetection: null, error: null }
		startLoop(cam.id, era)
	}
	for (const id of Object.keys(status)) {
		if (ids.has(Number(id))) continue
		clearTimeout(timers[id])
		delete timers[id]
		delete status[id]
	}
}

const startWorkers = async () => {
	if (process.env.object_ON !== "true" || !isPrimeInstance) return
	stopWorkers()
	const era = epoch
	await reconcile(era)
	if (era !== epoch) return
	pruneTimer = setInterval(() => {
		pruneCaptures().catch(() => {})
		sweepTemp().catch(() => {})
	}, PRUNE_INTERVAL_MS)
	reconcileTimer = setInterval(() => reconcile(era), CAMERA_TTL_MS)
	console.log(`🔍 Object detection workers started for ${Object.values(status).filter((s) => s.running).length} camera(s)`)
}

const stopWorkers = () => {
	epoch++
	_cameras = null
	_camerasAt = 0
	captureWriteFailing = false
	clearInterval(pruneTimer)
	pruneTimer = null
	clearInterval(reconcileTimer)
	reconcileTimer = null
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
	sweepTemp,
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
