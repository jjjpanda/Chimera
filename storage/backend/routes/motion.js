var express    = require("express")
const { subprocess } = require("lib")

const app = express.Router()

subprocess.checkProcess("motion", () => {
	console.log("▶ Motion process detected ✅")
}, () => {
	console.log("▶ Motion server needs a motion process ⚠️")
})

app.get("/status", (req, res, next) => {
	req.processName = "motion"
	next()
}, subprocess.processListMiddleware)

module.exports = app