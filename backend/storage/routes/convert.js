require('dotenv').config()
var express    = require('express')
var { 
    validateBody 
}              = require('../../lib/validators.js')
var {
    validateRequest,
    validateID,
}              = require('./lib/converter.js')
var {
    createVideo,
    listOfFrames,
}              = require('./lib/video.js')
var {
    createZip,
}              = require('./lib/zip.js')
var {
    statusProcess,
    cancelProcess,
    listProcess,
    deleteProcess
}              = require('./lib/process.js')

const app = express.Router();

app.post('/createVideo', validateBody, validateRequest, createVideo)
app.post('/listFramesVideo', validateBody, validateRequest, listOfFrames)

app.post('/createZip', validateBody, validateRequest, createZip)

app.post('/statusProcess', validateBody, validateID, statusProcess)
app.post('/cancelProcess', validateBody, validateID, cancelProcess)
app.post('/listProcess', listProcess)
app.post('/deleteProcess', validateBody, validateID, deleteProcess)

/**
 * NEEDS TO BE MOVED
 */
var { 
    oneCommand,
    afterPath,
    validatePath,
    numberSwitch,
    formattedCommandResponse,
    pathCommandAppend
}              = require('./commands.js')

app.post('/pathSize', validateBody, validatePath, pathCommandAppend, oneCommand(`sudo du -sh ${process.env.filePath}`, "SIZE CHECK", undefined, true), formattedCommandResponse)
app.post('/pathFileCount', validateBody, validatePath, pathCommandAppend, afterPath(' | wc -l'), oneCommand(`ls ${process.env.filePath}`, "FILE COUNT", undefined, true), formattedCommandResponse)
app.post('/pathDelete', validateBody, validatePath, pathCommandAppend, oneCommand(`sudo rm -rf ${process.env.filePath}`, "DELETE PATH", undefined, true), formattedCommandResponse)
app.post('/pathClean', validateBody, validatePath, pathCommandAppend, afterPath(" -mtime +$ -type f -delete"), numberSwitch("$"), oneCommand(`sudo find ${process.env.filePath}`, "CLEAN PATH", undefined, true), formattedCommandResponse)

module.exports = app