var express    = require("express")
const path = require("path")
const { subprocess } = require("lib")
const memory = require("memory")

const app = express.Router()

const restartAttempts = memory.loginAttempts()
const restartLimiter = (req, res, next) => {
	const key = `${req.ip || ""}:${req.path}`
	restartAttempts.loginReserve(key, 20, 60 * 1000, (blocked) => {
		if(blocked) return res.status(429).send({})
		next()
	})
}

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

app.post("/restart", restartLimiter, (req, res, next) => {
	const {camera} = req.body
	if(!/^\d+$/.test(String(camera))){
		res.status(400).send({})
	}
	else{
		req.processName = `live_stream_cam_${camera}`
		next()
	}
}, subprocess.restart)

app.use("/feed", express.static(path.join(process.env.livestream_FOLDERPATH, "feed")))

module.exports = app