var express    = require('express')
var {validateBody} = require('lib')

const app = express.Router();

const {tempMiddleware} = require('lib')
const {deprecation, construction} = tempMiddleware

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
    summaryMetrics,
    getCachedFileData
} = require('./lib/file.js')

app.get('/pathStats', fileStats)

app.post('/pathSizeDeprecated', deprecation, validateBody, validateCameraAndAppendToPath, directoryList, fileSize) 
app.post('/pathFileCountDeprecated', deprecation, validateBody, validateCameraAndAppendToPath, directoryList, fileCount)
app.post('/pathCleanDeprecated', deprecation, validateBody, validateCameraAndAppendToPath, validateDays, directoryList, filterList("before"), deleteFileList)

app.post('/pathSize', validateBody, validateCameraAndAppendToPath, getCachedFileData("size")) 
app.post('/pathFileCount', validateBody, validateCameraAndAppendToPath, getCachedFileData("count"))
app.post('/pathDelete', validateBody, validateCameraAndAppendToPath, deleteFileDirectory) 
app.post('/pathClean', construction)

app.post('/pathMetrics', validateBody, summaryMetrics)

module.exports = app