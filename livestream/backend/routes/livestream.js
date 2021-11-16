var express    = require("express")
const path = require("path")
const { startAllLiveStreams } = require("./lib/subprocess.js")
const pm2 = require("pm2")
const { subprocess } = require("lib")

const app = express.Router()

startAllLiveStreams()

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