require("dotenv").config()
const path = require('path')

const config = {
	apps : [{
		script: "server.js",
		name: "chimeraContinuous",
		log: "./log/chimera.dev.log",
		log_date_format:"YYYY-MM-DD HH:mm:ss",
		watch: ["."],
		ignore_watch: ["shared", "feed", "*.log", process.env.password_FILEPATH],
		env: {
			"NODE_ENV": "development",
		}
	}]
}

if(process.env.storage_ON === "true"){
	config.apps.push({
		script: `npx mkdirp ${process.env.storage_FILEPATH}shared/captures && motion -c ${process.env.storage_MOTION_CONFPATH}`,
		name: "motion",
		log: "./log/motion.dev.log",
		log_date_format:"YYYY-MM-DD HH:mm:ss",
	})
}

if(process.env.livestream_ON === "true"){
	let cameraIndex = 1
	const cameraURL = (i) => process.env[`livestream_CAMERA_URL_${i}`]
	while(cameraURL(cameraIndex) in process.env){
		config.apps.push({
			script: `npx mkdirp ${process.env.livestream_FILEPATH}feed/${cameraIndex} && ffmpeg -loglevel quiet -i "${cameraURL(cameraIndex)}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${path.join(process.env.livestream_FILEPATH, "feed", cameraIndex.toString(), "video.m3u8")}`,
			name: `live_stream_cam_${cameraIndex}`,
			log: `./log/livestream.${cameraIndex}.dev.log`,
			log_date_format:"YYYY-MM-DD HH:mm:ss",
		})
		cameraIndex++
	}
}

module.exports = config