var express    = require("express")
const path = require("path")
const { subprocess, rateLimiter } = require("lib")

const app = express.Router()

const RESTART_MAX = 3
const RESTART_WINDOW = 60 * 1000

const isCameraId = (camera) => /^\d{1,10}$/.test(String(camera))

const { rateLimit } = rateLimiter("LIVESTREAM_RESTART")
const restartLimiter = rateLimit({ windowMs: RESTART_WINDOW, max: RESTART_MAX, keyFn: (req) => `${req.body.camera}` })

subprocess.checkProcess("live_stream_cam", () => {
	console.log("▶ Livestream process detected ✅")
}, () => {
	console.log("▶ Livestream server needs a livestream process ⚠️")
})

app.get("/status", (req, res, next) => {
	const {camera} = req.query
	if(!camera){
		req.processName = "live_stream_cam"
	}
	else if(!isCameraId(camera)){
		return res.status(400).send({})
	}
	else{
		req.processName = `live_stream_cam_${camera}`
	}
	next()
}, subprocess.processListMiddleware)

app.post("/restart", (req, res, next) => {
	const {camera} = req.body
	if(!isCameraId(camera)){
		res.status(400).send({})
	}
	else{
		req.processName = `live_stream_cam_${camera}`
		next()
	}
}, restartLimiter, subprocess.restart)

app.use("/feed", express.static(path.join(process.env.livestream_FOLDERPATH, "feed")))

module.exports = app