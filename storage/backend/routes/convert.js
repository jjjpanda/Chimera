var express    = require("express")
var {validateBody, auth} = require("lib")
const { requireAdmin } = auth
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

app.post("/createVideo", requireAdmin, validateBody, validateDays, validateRequest, createVideo)
app.post("/listFramesVideo", validateBody, validateDays, validateRequest, listOfFrames)

app.post("/createZip", requireAdmin, validateBody, validateDays, validateRequest, createZip)

app.post("/statusProcess", requireAdmin, validateBody, validateID, statusProcess)
app.post("/cancelProcess", requireAdmin, validateBody, validateID, cancelProcess)
app.get("/listProcess", listProcess)
app.post("/deleteProcess", requireAdmin, validateBody, validateID, deleteProcess)

module.exports = app