var express    = require("express")
const path = require("path")
const { subprocess } = require("lib")

const app = express.Router()

subprocess.checkProcess("live_stream_cam", () => {
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
}, subprocess.processListMiddleware)

app.post("/restart", (req, res, next) => {
	const {camera} = req.body
	if(camera){
		req.processName = `live_stream_cam_${camera}`
		next()
	}
	else{
		res.status(400).send({})
	}
}, subprocess.restart)

app.use("/feed", express.static(path.join(process.env.livestream_FOLDERPATH, "feed")))

module.exports = app