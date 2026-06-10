var express    = require("express")
var {validateBody, auth} = require("lib")
const { requireAdmin } = auth

const app = express.Router()

const {
	validateCameraAndAppendToPath,
	validateDays,
	getCameraMetricFromDatabase,
	updateDeletionOfFiles,
	deleteFileDirectory,
	deleteFilesBeforeDateGlob,
	fileStats,
	cameraMetrics,
	autoClean
} = require("./lib/file.js")

app.post("/pathSize", validateBody, validateCameraAndAppendToPath, getCameraMetricFromDatabase("size")) 
app.post("/pathFileCount", validateBody, validateCameraAndAppendToPath, getCameraMetricFromDatabase("count"))
app.post("/pathDelete", requireAdmin, validateBody, validateCameraAndAppendToPath, updateDeletionOfFiles("directory"), deleteFileDirectory)
app.post("/pathClean", requireAdmin, validateBody, validateCameraAndAppendToPath, validateDays, updateDeletionOfFiles("files"), deleteFilesBeforeDateGlob)

app.get("/pathStats", fileStats)
app.post("/pathMetrics", cameraMetrics)
app.post("/pathAutoClean", requireAdmin, autoClean)

module.exports = app