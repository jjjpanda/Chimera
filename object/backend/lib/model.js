const fs = require("fs")
const path = require("path")

const MODEL_DIR = path.join(__dirname, "..", "model")
const MODEL_PATH = path.join(MODEL_DIR, "yolox_tiny.onnx")
const DEFAULT_URL = "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx"
const MIN_BYTES = 20000000

const ensureModel = async () => {
	if (fs.existsSync(MODEL_PATH) && fs.statSync(MODEL_PATH).size > MIN_BYTES) {
		return MODEL_PATH
	}
	const url = process.env.object_MODEL_URL || DEFAULT_URL
	console.log("🔍 Downloading YOLOX model from", url)
	const res = await fetch(url)
	if (!res.ok) throw new Error(`model download failed: ${res.status}`)
	const buffer = Buffer.from(await res.arrayBuffer())
	if (buffer.length < MIN_BYTES) throw new Error("downloaded model too small")
	fs.mkdirSync(MODEL_DIR, { recursive: true })
	fs.writeFileSync(MODEL_PATH, buffer)
	console.log(`🔍 Model saved (${(buffer.length / 1e6).toFixed(1)} MB)`)
	return MODEL_PATH
}

module.exports = { ensureModel, MODEL_PATH }
