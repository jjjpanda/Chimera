var express    = require("express")
const path = require("path")
const { subprocess, auth } = require("lib")
const memory = require("memory")

const app = express.Router()

const RESTART_MAX = 20
const RESTART_WINDOW = 60 * 1000
const sharedAttempts = process.env.memory_ON == "true"
const restartClient = sharedAttempts ? memory.client("LIVESTREAM_RESTART") : null
const localAttempts = memory.loginAttempts()

const isCameraId = (camera) => /^\d{1,10}$/.test(String(camera))

const reserveRestart = (key, cb) => {
	if (!sharedAttempts || !restartClient.connected) return localAttempts.loginReserve(key, RESTART_MAX, RESTART_WINDOW, cb)
	restartClient.timeout(1000).emit("loginReserve", key, RESTART_MAX, RESTART_WINDOW, (err, blocked) => {
		if (err) {
			restartClient.emit("loginRelease", key)
			return localAttempts.loginReserve(key, RESTART_MAX, RESTART_WINDOW, cb)
		}
		cb(blocked)
	})
}

const restartLimiter = (req, res, next) => {
	const key = `${req.ip || ""}:${req.path}:${req.body.camera}`
	reserveRestart(key, (blocked) => {
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

app.post("/restart", auth.requireAdmin, (req, res, next) => {
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