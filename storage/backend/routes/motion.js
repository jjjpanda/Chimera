var express    = require("express")
const pm2 = require("pm2")
const { subprocess } = require("lib")

const app = express.Router()

subprocess.checkProcess(pm2, "motion", () => {
	console.log("▶ Motion process detected ✅")
}, () => {
	console.log("▶ Motion server needs a motion process ⚠️")
})

app.get("/status", (req, res, next) => {
	req.processName = "motion"
	next()
}, subprocess.processListMiddleware(pm2))

module.exports = app