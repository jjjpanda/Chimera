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

function buildFullUrl(rtsp_url, userpass) {
	let encodedUserpass = userpass
	if (userpass) {
		const idx = userpass.indexOf(":")
		encodedUserpass = idx !== -1
			? encodeURIComponent(userpass.slice(0, idx)) + ":" + encodeURIComponent(userpass.slice(idx + 1))
			: encodeURIComponent(userpass)
	}
	return encodedUserpass ? rtsp_url.replace(/^([a-z][a-z0-9+\-.]*:\/\/)/i, (_, proto) => `${proto}${encodedUserpass}@`) : rtsp_url
}

function urlProblem(rtsp_url, full_url) {
	if (!rtsp_url || !/^[a-z][a-z0-9+\-.]*:\/\//i.test(rtsp_url)) return "missing or invalid scheme (e.g. rtsp://)"
	if (/^[a-z][a-z0-9+\-.]*:\/\/[^/?#]*@/i.test(rtsp_url)) return "credentials must be set via netcam_userpass, not embedded in netcam_url"
	try {
		new URL(rtsp_url)
		new URL(full_url)
		return null
	} catch (e) {
		return "not a valid URL (ensure special characters in credentials are URL-encoded)"
	}
}

/** @returns {Promise<string|null>} null when unconfigured; rejects when the conf is unreadable. */
async function cameraConfDir() {
	const confPath = process.env.storage_MOTION_CONF_FILEPATH
	if (!confPath) return null
	const main = parseConf(await fs.promises.readFile(confPath, "utf8"))
	if (!main.camera_dir) return null
	return path.isAbsolute(main.camera_dir) ? main.camera_dir : path.resolve(path.dirname(confPath), main.camera_dir)
}

/** @returns {Promise<string[]>} */
async function cameraConfFiles(id) {
	const dir = await cameraConfDir()
	if (!dir) return []
	const files = await fs.promises.readdir(dir)
	const confFiles = files.filter(f => f.endsWith(".conf"))
	const results = await Promise.all(confFiles.map(async f => {
		const conf = parseConf(await fs.promises.readFile(path.join(dir, f), "utf8"))
		if (parseInt(conf.camera_id) === parseInt(id)) return path.join(dir, f)
		return null
	}))
	return results.filter(Boolean)
}

function cameraConfDirSync() {
	try {
		const confPath = process.env.storage_MOTION_CONF_FILEPATH
		if (!confPath) return null
		const main = parseConf(fs.readFileSync(confPath, "utf8"))
		if (!main.camera_dir) return null
		return path.isAbsolute(main.camera_dir) ? main.camera_dir : path.resolve(path.dirname(confPath), main.camera_dir)
	} catch (e) {
		console.error("Failed to resolve camera conf dir:", e)
		return null
	}
}

function loadCamerasSync() {
	try {
		const cameraDir = cameraConfDirSync()
		if (!cameraDir) return []
		return fs.readdirSync(cameraDir)
			.filter(f => f.endsWith(".conf"))
			.map(f => {
				const cam = parseConf(fs.readFileSync(path.join(cameraDir, f), "utf8"))
				const rtsp_url = cam.netcam_url || ""
				const full_url = buildFullUrl(rtsp_url, cam.netcam_userpass || "")
				return { id: parseInt(cam.camera_id) || 0, name: cam.camera_name || f, rtsp_url, full_url }
			})
			.filter(c => {
				if (c.id <= 0) return false
				const problem = urlProblem(c.rtsp_url, c.full_url)
				if (problem) {
					console.error(`Invalid URL for camera ${c.name}: ${problem}`)
					return false
				}
				return true
			})
			.sort((a, b) => a.id - b.id)
	} catch (e) {
		console.error("Failed to load cameras:", e)
		return []
	}
}

/** @returns {Promise<Array>} [] only when no cameras are configured; rejects when the confs cannot be read. */
async function loadCameras() {
	const cameraDir = await cameraConfDir()
	if (!cameraDir) return []
	const files = await fs.promises.readdir(cameraDir)
	const confFiles = files.filter(f => f.endsWith(".conf"))
	const cameras = await Promise.all(confFiles.map(async f => {
		const cam = parseConf(await fs.promises.readFile(path.join(cameraDir, f), "utf8"))
		const rtsp_url = cam.netcam_url || ""
		const full_url = buildFullUrl(rtsp_url, cam.netcam_userpass || "")
		return { id: parseInt(cam.camera_id) || 0, name: cam.camera_name || f, rtsp_url, full_url }
	}))
	return cameras
		.filter(c => {
			if (c.id <= 0) return false
			const problem = urlProblem(c.rtsp_url, c.full_url)
			if (problem) {
				console.error(`Invalid URL for camera ${c.name}: ${problem}`)
				return false
			}
			return true
		})
		.sort((a, b) => a.id - b.id)
}

module.exports = { parseConf, loadCameras, loadCamerasSync, buildFullUrl, urlProblem, cameraConfDir, cameraConfFiles, cameraConfDirSync }
