require("dotenv").config()
const path = require("path")

const isDev = process.env.NODE_ENV == "development"

const config = {
	apps : [{
		script: "server.js",
		name: `chimera${isDev ? "Continuous" : ""}`,
		log: `./log/chimera.${isDev ? "dev." : ""}log`,
		log_date_format:"YYYY-MM-DD HH:mm:ss",
		...(isDev ? {
			watch: ["."],
			ignore_watch: ["shared", "feed", "*.log", "log", ".env", ".well-known", "*.config.js", "*.json", "node_modules"],
		} : {}),
		instances: process.env.chimeraInstances == 1 ? undefined : process.env.chimeraInstances,
		env: {
			"NODE_ENV": process.env.NODE_ENV,
		}
	}]
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
	config.apps.push({
		script: `mkdirp ${process.env.storage_FOLDERPATH}shared/captures && motion -c ${process.env.storage_MOTION_CONF_FILEPATH}`,
		name: "motion",
		log: `./log/motion.${isDev ? "dev" : "pm2"}.log`,
		log_date_format:"YYYY-MM-DD HH:mm:ss",
	})
}

if(process.env.livestream_ON === "true"){
	let cameraIndex = 1
	const cameraURL = (i) => process.env[`livestream_CAMERA_URL_${i}`]
	const cameraKey = (i) => `livestream_CAMERA_URL_${i}`
	while(cameraKey(cameraIndex) in process.env){
		config.apps.push({
			script: `mkdirp ${process.env.livestream_FOLDERPATH}feed/${cameraIndex} && ffmpeg -rtsp_transport tcp -i "${cameraURL(cameraIndex)}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${path.join(process.env.livestream_FOLDERPATH, "feed", cameraIndex.toString(), "video.m3u8")}`,
			name: `live_stream_cam_${cameraIndex}`,
			log: `./log/livestream.${cameraIndex}${isDev ? ".dev" : ""}.log`,
			log_date_format:"YYYY-MM-DD HH:mm:ss",
		})
		cameraIndex++
	}
}

if(process.env.object_ON === "true"){
	config.apps.push({
		script: "npx object",
		name: "object",
		log: `./log/object.${isDev ? "dev" : "pm2"}.log`,
		log_date_format:"YYYY-MM-DD HH:mm:ss",
	})
}

module.exports = config
