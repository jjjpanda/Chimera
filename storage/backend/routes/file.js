var express    = require('express')
var {validateBody} = require('lib')

const app = express.Router();

const {
    validateCameraAndAppendToPath, 
    directoryList, 
    fileSize, 
    fileCount, 
    deleteFileDirectory, 
    validateDays, 
    filterList,
    deleteFileList,
    fileStats,
    summaryMetrics
} = require('./lib/file.js')

app.get('/pathStats', fileStats)

app.post('/pathSize', validateBody, validateCameraAndAppendToPath, directoryList, fileSize) 
app.post('/pathFileCount', validateBody, validateCameraAndAppendToPath, directoryList, fileCount)
app.post('/pathDelete', validateBody, validateCameraAndAppendToPath, deleteFileDirectory) 
app.post('/pathClean', validateBody, validateCameraAndAppendToPath, validateDays, directoryList, filterList("before"), deleteFileList) 

app.post('/pathMetrics', validateBody, summaryMetrics)

module.exports = app