const fs = require("fs")
const path = require("path")

function parseConf(text) {
	const obj = {}
	for (const line of text.split("\n")) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith("#")) continue
		const idx = trimmed.search(/\s/)
		if (idx === -1) continue
		obj[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).trim()
	}
	return obj
}

let _cache = null

function loadCameras() {
	if (_cache && _cache.length) return _cache
	try {
		const confPath = process.env.storage_MOTION_CONF_FILEPATH
		if (!confPath) return []
		const main = parseConf(fs.readFileSync(confPath, "utf8"))
		const cameraDir = main.camera_dir
		if (!cameraDir) return []
		_cache = fs.readdirSync(cameraDir)
			.filter(f => f.endsWith(".conf"))
			.map(f => {
				const cam = parseConf(fs.readFileSync(path.join(cameraDir, f), "utf8"))
				const rtsp_url = cam.netcam_url || ""
				const userpass = cam.netcam_userpass || ""
				const full_url = userpass ? rtsp_url.replace(/^([a-z][a-z0-9+\-.]*:\/\/)/i, (_, proto) => `${proto}${userpass}@`) : rtsp_url
				return { id: parseInt(cam.camera_id) || 0, name: cam.camera_name || f, rtsp_url, full_url }
			})
			.filter(c => c.id > 0)
			.sort((a, b) => a.id - b.id)
		return _cache
	} catch (e) {
		return []
	}
}

module.exports = { parseConf, loadCameras }
