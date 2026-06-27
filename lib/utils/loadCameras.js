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

function loadCameras() {
	try {
		const confPath = process.env.storage_MOTION_CONF_FILEPATH
		if (!confPath) return []
		const main = parseConf(fs.readFileSync(confPath, "utf8"))
		if (!main.camera_dir) return []
		const cameraDir = path.isAbsolute(main.camera_dir) ? main.camera_dir : path.resolve(path.dirname(confPath), main.camera_dir)
		return fs.readdirSync(cameraDir)
			.filter(f => f.endsWith(".conf"))
			.map(f => {
				const cam = parseConf(fs.readFileSync(path.join(cameraDir, f), "utf8"))
				const rtsp_url = cam.netcam_url || ""
				const userpass = cam.netcam_userpass || ""
				const full_url = userpass ? rtsp_url.replace(/^([a-z][a-z0-9+\-.]*:\/\/)/i, (_, proto) => `${proto}${userpass}@`) : rtsp_url
				return { id: parseInt(cam.camera_id) || 0, name: cam.camera_name || f, rtsp_url, full_url }
			})
			.filter(c => c.id > 0 && /^[a-z][a-z0-9+\-.]*:\/\//i.test(c.rtsp_url))
			.sort((a, b) => a.id - b.id)
	} catch (e) {
		return []
	}
}

module.exports = { parseConf, loadCameras }
