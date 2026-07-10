require("dotenv").config()
const path = require("path")

const isDev = process.env.NODE_ENV == "development"

if ((Number(process.env.chimeraInstances) > 1 || process.env.chimeraInstances === "max") && process.env.memory_ON !== "true") {
	console.warn("Forcing memory_ON=true because chimeraInstances > 1 or max")
	process.env.memory_ON = "true"
}

const scaled = process.env.chimeraInstances == 1 ? undefined : process.env.chimeraInstances
const baseEnv = { NODE_ENV: process.env.NODE_ENV, memory_ON: process.env.memory_ON }
const ignore_watch = ["shared", "feed", "objectTemp", "objectCaptures", "object/backend/model", "*.log", "log", ".env", ".well-known", "*.config.js", "*.json", "node_modules"]

const svc = (name, { instances = scaled } = {}) => ({
	script: `${name}/start.js`,
	name,
	log: `./log/${name}.${isDev ? "dev." : ""}log`,
	log_date_format: "YYYY-MM-DD HH:mm:ss",
	...(isDev ? { watch: [name, "lib"], ignore_watch } : {}),
	instances,
	env: baseEnv,
})

const config = { apps: [] }

const services = [
	{ name: "command" },
	{ name: "storage" },
	{ name: "livestream" },
	{ name: "schedule" },
	{ name: "object", instances: 1 },
	{ name: "gateway" },
	{ name: "memory", instances: 1 },
]
for (const { name, instances } of services) {
	if (process.env[`${name}_ON`] === "true") config.apps.push(svc(name, { instances }))
	else console.log(`↷ skipping ${name} (${name}_ON is "${process.env[`${name}_ON`] ?? "unset"}")`)
}

if(!isDev){
	config.apps.push({
		script: "npx heartbeat",
		name: "heartbeat",
		log: "./log/heartbeat.log",
		log_date_format:"YYYY-MM-DD HH:mm:ss"
	})
}

if(process.env.storage_ON === "true"){
	const fs = require("fs")
	const storageFolder = process.env.storage_FOLDERPATH
	if (storageFolder) {
		try {
			fs.mkdirSync(path.join(storageFolder, "shared/captures"), { recursive: true })
		} catch (e) {
			console.warn("⚠️ Failed to pre-create storage captures directory:", e.message)
		}
	} else {
		console.warn("⚠️ storage_ON=true but storage_FOLDERPATH is not defined")
	}
	config.apps.push({
		script: "motion",
		args: ["-c", process.env.storage_MOTION_CONF_FILEPATH],
		interpreter: "none",
		name: "motion",
		log: `./log/motion.${isDev ? "dev" : "pm2"}.log`,
		log_date_format:"YYYY-MM-DD HH:mm:ss",
	})
}

if(process.env.livestream_ON === "true"){
	const { loadCamerasSync } = require("./lib/utils/loadCameras.js")
	const liveCams = loadCamerasSync()
	if (!liveCams.length) console.error("livestream_ON=true but no cameras loaded — check storage_MOTION_CONF_FILEPATH and .conf files")
	const fs = require("fs")
	const livestreamFolder = process.env.livestream_FOLDERPATH
	if (livestreamFolder) {
		for (const cam of liveCams) {
			try {
				fs.mkdirSync(path.join(livestreamFolder, "feed", String(cam.id)), { recursive: true })
			} catch (e) {
				console.warn(`⚠️ Failed to pre-create livestream feed directory for camera ${cam.id}:`, e.message)
			}
			config.apps.push({
				script: process.env.ffmpeg_FILEPATH || "ffmpeg",
				args: [
					"-rtsp_transport", "tcp",
					"-i", cam.full_url,
					"-fflags", "flush_packets",
					"-max_delay", "1",
					"-flags", "-global_header",
					"-hls_time", "1",
					"-hls_list_size", "3",
					"-segment_wrap", "10",
					"-hls_flags", "delete_segments",
					"-vcodec", "copy",
					"-y", path.join(livestreamFolder, "feed", cam.id.toString(), "video.m3u8"),
				],
				interpreter: "none",
				name: `live_stream_cam_${cam.id}`,
				log: `./log/livestream.${cam.id}${isDev ? ".dev" : ""}.log`,
				log_date_format:"YYYY-MM-DD HH:mm:ss",
			})
		}
	} else {
		console.warn("⚠️ livestream_ON=true but livestream_FOLDERPATH is not defined")
	}
}

module.exports = config
