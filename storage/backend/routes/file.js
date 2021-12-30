var express    = require("express")
var {validateBody} = require("lib")

const app = express.Router()

const {
	validateCameraAndAppendToPath,
	validateDays,
	getCameraMetricFromDatabase,
	updateDeletionOfFiles,
	deleteFileDirectory,
	deleteFilesBeforeDateGlob,
	fileStats,
	cameraMetrics
} = require('./lib/file.js');

app.post("/pathSize", validateBody, validateCameraAndAppendToPath, getCameraMetricFromDatabase('size')) 
app.post("/pathFileCount", validateBody, validateCameraAndAppendToPath, getCameraMetricFromDatabase('count'))
app.post("/pathDelete", validateBody, validateCameraAndAppendToPath, updateDeletionOfFiles('directory'), deleteFileDirectory) 
app.post("/pathClean", validateBody, validateCameraAndAppendToPath, validateDays, updateDeletionOfFiles('files'), deleteFilesBeforeDateGlob)

app.get("/pathStats", fileStats)
app.post("/pathMetrics", cameraMetrics)

module.exports = app