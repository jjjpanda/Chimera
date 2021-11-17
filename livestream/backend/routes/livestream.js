var express    = require("express")
const path = require("path")
const pm2 = require("pm2")
const { subprocess } = require("lib")

const app = express.Router()

subprocess.checkProcess(pm2, "live_stream_cam", () => {
	console.log("▶ Livestream process detected ✅")
}, () => {
	console.log("▶ Livestream server needs a livestream process ⚠️")
})

app.get("/status", (req, res, next) => {
	const {camera} = req.query
	if(camera){
		req.processName = `live_stream_cam_${camera}`
	}
	else{
		req.processName = "live_stream_cam"
	}
	next()
}, subprocess.processListMiddleware(pm2))

app.use("/feed", express.static(path.join(process.env.livestream_FILEPATH, "feed")))

module.exports = app