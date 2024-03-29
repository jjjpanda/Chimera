var express    = require("express")
var {validateBody} = require("lib")
var {
	validateDays,
	validateRequest,
	validateID,
}              = require("./lib/converter.js")
var {
	createVideo,
	listOfFrames,
}              = require("./lib/video.js")
var {
	createZip,
}              = require("./lib/zip.js")
var {
	statusProcess,
	cancelProcess,
	listProcess,
	deleteProcess
}              = require("./lib/process.js")

const app = express.Router()

app.post("/createVideo", validateBody, validateDays, validateRequest, createVideo)
app.post("/listFramesVideo", validateBody, validateDays, validateRequest, listOfFrames)

app.post("/createZip", validateBody, validateRequest, createZip)

app.post("/statusProcess", validateBody, validateID, statusProcess)
app.post("/cancelProcess", validateBody, validateID, cancelProcess)
app.get("/listProcess", listProcess)
app.post("/deleteProcess", validateBody, validateID, deleteProcess)

module.exports = app