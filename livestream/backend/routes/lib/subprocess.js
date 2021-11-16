const pm2 = require("pm2")
const process = require("process")
const mkdirp = require("mkdirp")
const path = require("path")

module.exports = {

	startAllLiveStreams: () => {
		console.log("\t▶ Starting Live Stream Processes")
		let cameraIndex = 1
		while(`livestream_CAMERA_URL_${cameraIndex}` in process.env){
			createLiveStreamDirectories(cameraIndex, safeStartLiveStream)
			cameraIndex++
		}
	}
}

const createLiveStreamDirectories = (cameraNumber, callback) => {
	mkdirp(`${process.env.livestream_FILEPATH}feed/${cameraNumber}`).then(made => {
		console.log(`\tSetup Directory: Cam ${cameraNumber} ◀`)
		callback(cameraNumber)
	})
}

const safeStartLiveStream = (cameraNumber) => {
	stopLiveStream(cameraNumber, startLiveStream(cameraNumber))()
}

const startLiveStream = (cameraNumber) => () => {
	const cameraURL = process.env[`livestream_CAMERA_URL_${cameraNumber}`]
	pm2.start({
		script: `ffmpeg -loglevel quiet -i "${cameraURL}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${path.join(process.env.livestream_FILEPATH, "feed", cameraNumber.toString(), "video.m3u8")}`,
		name: `live_stream_cam_${cameraNumber}`
	}, onLiveStreamStart(cameraNumber))
}

const onLiveStreamStart = (cameraNumber) => (err, apps) => {
	if(err){
		console.log(`\tCouldn't Start Live Stream: Cam ${cameraNumber} ⚠`)
	}            
	else{
		console.log(`\tStarted Live Stream: Cam ${cameraNumber} ◀`)
	}
	process.on("SIGINT", stopLiveStream)
}

const stopLiveStream = (cameraNumber, callback = defaultStopLiveStreamCallback) => () => {
	pm2.stop(`live_stream_cam_${cameraNumber}`, callback)
}

const defaultStopLiveStreamCallback = () => {
	console.log(`Live Stream ${cameraNumber} Off`)
}