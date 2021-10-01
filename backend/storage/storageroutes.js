require('dotenv').config()
var express    = require('express')
var { 
    validateBody 
}              = require('../lib/validators.js')
var {
    validateRequest,
    validateID,
}              = require('../storage/converts/converter.js')
var {
    createVideo,
    listOfFrames,
}              = require('./converts/video.js')
var {
    createZip,
}              = require('./converts/zip.js')
var {
    statusProcess,
    cancelProcess,
    listProcess,
    deleteProcess
}              = require('./converts/process.js')

const app = express.Router();

app.post('/createVideo', validateBody, validateRequest, createVideo)
app.post('/listFramesVideo', validateBody, validateRequest, listOfFrames)

app.post('/createZip', validateBody, validateRequest, createZip)

app.post('/statusProcess', validateBody, validateID, statusProcess)
app.post('/cancelProcess', validateBody, validateID, cancelProcess)
app.post('/listProcess', listProcess)
app.post('/deleteProcess', validateBody, validateID, deleteProcess)

module.exports = app