var express    = require("express")
const path = require("path")
const { subprocess } = require("lib")
const memory = require("memory")
const { instanceCount } = require("../../../lib/utils/multiInstance.js")

const app = express.Router()

const restartAttempts = memory.loginAttempts()
const restartMax = Math.max(1, Math.ceil(20 / instanceCount(process.env.chimeraInstances)))
const restartLimiter = (req, res, next) => {
	const key = `${req.ip || ""}:${req.path}`
	restartAttempts.loginReserve(key, restartMax, 60 * 1000, (blocked) => {
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
	if(!/^\d{1,10}$/.test(String(camera))){
		res.status(400).send({})
	}
	else{
		req.processName = `live_stream_cam_${camera}`
		next()
	}
}, subprocess.restart)

app.use("/feed", express.static(path.join(process.env.livestream_FOLDERPATH, "feed")))

module.exports = app