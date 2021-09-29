require('dotenv').config()
var express    = require('express')
var { 
    validateBody 
}              = require('../tools/validators.js')
var {
    validateRequest,
    validateID,
}              = require('../converter/converter.js')
var {
    createVideo,
    listOfFrames,
}              = require('../converter/video.js')
var {
    createZip,
}              = require('../converter/zip.js')
var {
    statusProcess,
    cancelProcess,
    listProcess,
    deleteProcess
}              = require('../converter/process.js')

const app = express.Router();

app.post('/createVideo', validateBody, validateRequest, createVideo)
app.post('/listFramesVideo', validateBody, validateRequest, listOfFrames)

app.post('/createZip', validateBody, validateRequest, createZip)

app.post('/statusProcess', validateBody, validateID, statusProcess)
app.post('/cancelProcess', validateBody, validateID, cancelProcess)
app.post('/listProcess', listProcess)
app.post('/deleteProcess', validateBody, validateID, deleteProcess)

module.exports = app