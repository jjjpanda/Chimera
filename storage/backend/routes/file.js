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
	dailyStats,
	cameraMetrics,
	autoClean,
	deferIfExporting
} = require("./lib/file.js")

app.post("/pathSize", validateBody, validateCameraAndAppendToPath, getCameraMetricFromDatabase("size")) 
app.post("/pathFileCount", validateBody, validateCameraAndAppendToPath, getCameraMetricFromDatabase("count"))
app.post("/pathDelete", requireAdmin, validateBody, validateCameraAndAppendToPath, deferIfExporting, updateDeletionOfFiles("directory"), deleteFileDirectory)
app.post("/pathClean", requireAdmin, validateBody, validateCameraAndAppendToPath, validateDays, deferIfExporting, updateDeletionOfFiles("files"), deleteFilesBeforeDateGlob)

app.get("/pathStats", fileStats)
app.get("/dailyStats", dailyStats)
app.post("/pathMetrics", cameraMetrics)
app.post("/pathAutoClean", requireAdmin, deferIfExporting, autoClean)

module.exports = app