const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

const MODEL_DIR = path.join(__dirname, "..", "model")
const MODEL_PATH = path.join(MODEL_DIR, "yolox_tiny.onnx")
const DEFAULT_URL = "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx"
const DEFAULT_SHA256 = "427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7"
const MIN_BYTES = 20000000

const getFileHash = (filePath) => new Promise((resolve, reject) => {
	const hash = crypto.createHash("sha256")
	const stream = fs.createReadStream(filePath)
	stream.on("error", err => reject(err))
	stream.on("data", chunk => hash.update(chunk))
	stream.on("end", () => resolve(hash.digest("hex")))
})

const getHash = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex")

const ensureModel = async () => {
	const customUrl = process.env.object_MODEL_URL
	const customSha = process.env.object_MODEL_SHA256
	const expectedSha256 = customSha ? customSha.toLowerCase() : (customUrl ? null : DEFAULT_SHA256)

	if (fs.existsSync(MODEL_PATH)) {
		if (expectedSha256) {
			try {
				const hash = await getFileHash(MODEL_PATH)
				if (hash === expectedSha256) {
					return MODEL_PATH
				}
				console.log("🔍 Existing model failed SHA256 check, redownloading...")
			} catch (err) {
				console.log("🔍 Existing model unreadable, removing and redownloading...", err.message)
				try { fs.unlinkSync(MODEL_PATH) } catch (e) { console.warn("Could not remove corrupt model file", e.message) }
			}
		} else {
			if (fs.statSync(MODEL_PATH).size > MIN_BYTES) {
				return MODEL_PATH
			}
			console.log("🔍 Existing model failed size check, redownloading...")
		}
	}
	const url = customUrl || DEFAULT_URL
	console.log("🔍 Downloading YOLOX model from", url)
	const res = await fetch(url)
	if (!res.ok) throw new Error(`model download failed: ${res.status}`)
	const buffer = Buffer.from(await res.arrayBuffer())
	
	if (expectedSha256) {
		if (getHash(buffer) !== expectedSha256) throw new Error("downloaded model failed SHA256 integrity check")
	} else {
		if (buffer.length < MIN_BYTES) throw new Error("downloaded model too small")
	}
	
	fs.mkdirSync(MODEL_DIR, { recursive: true })
	fs.writeFileSync(MODEL_PATH, buffer)
	console.log(`🔍 Model saved (${(buffer.length / 1e6).toFixed(1)} MB)`)
	return MODEL_PATH
}

module.exports = { ensureModel, MODEL_PATH }

