var express    = require('express')
var {validateBody} = require('lib')

const app = express.Router();

const {
    validateCameraAndAppendToPath, 
    directoryList, 
    fileSize, 
    fileCount, 
    deleteFiles, 
    validateDays, 
    deleteFilesBasedOnCreationTime
} = require('./lib/file.js')

app.post('/pathSize', validateBody, validateCameraAndAppendToPath, directoryList, fileSize) 
app.post('/pathFileCount', validateBody, validateCameraAndAppendToPath, directoryList, fileCount)
app.post('/pathDelete', validateBody, validateCameraAndAppendToPath, deleteFiles) 
app.post('/pathClean', validateBody, validateCameraAndAppendToPath, validateDays, directoryList, deleteFilesBasedOnCreationTime) 

module.exports = app