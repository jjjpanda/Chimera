var express    = require('express')
var {validateBody} = require('lib')

const app = express.Router();

const {
    validateCameraAndAppendToPath, 
    directoryList, 
    deleteFileDirectory, 
    validateDays, 
    filterList,
    fileStats,
    getCachedFileData,
    deleteFilesBeforeDateGlob, 
} = require('./lib/file.js')

app.get('/pathStats', fileStats)

app.post('/pathSize', validateBody, validateCameraAndAppendToPath, getCachedFileData("size")) 
app.post('/pathFileCount', validateBody, validateCameraAndAppendToPath, getCachedFileData("count"))
app.post('/pathDelete', validateBody, validateCameraAndAppendToPath, deleteFileDirectory) 
app.post('/pathClean', validateBody, validateCameraAndAppendToPath, validateDays, directoryList, filterList("before"), deleteFilesBeforeDateGlob)

app.post('/pathMetrics', getCachedFileData('all'))

module.exports = app