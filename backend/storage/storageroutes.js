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
const {auth} = require('../lib/auth');

const app = express.Router();

app.post('/createVideo', auth, validateBody, validateRequest, createVideo)
app.post('/listFramesVideo', auth, validateBody, validateRequest, listOfFrames)

app.post('/createZip', auth, validateBody, validateRequest, createZip)

app.post('/statusProcess', auth, validateBody, validateID, statusProcess)
app.post('/cancelProcess', auth, validateBody, validateID, cancelProcess)
app.post('/listProcess', auth, listProcess)
app.post('/deleteProcess', auth, validateBody, validateID, deleteProcess)

var { 
    oneCommand,
    afterPath,
    validatePath,
    numberSwitch,
    formattedCommandResponse,
    pathCommandAppend
}              = require('../command/commands.js')

app.post('/pathSize', auth, validateBody, validatePath, pathCommandAppend, oneCommand(`sudo du -sh ${process.env.filePath}`, "SIZE CHECK", undefined, true), formattedCommandResponse)
app.post('/pathFileCount', auth, validateBody, validatePath, pathCommandAppend, afterPath(' | wc -l'), oneCommand(`ls ${process.env.filePath}`, "FILE COUNT", undefined, true), formattedCommandResponse)
app.post('/pathDelete', auth, validateBody, validatePath, pathCommandAppend, oneCommand(`sudo rm -rf ${process.env.filePath}`, "DELETE PATH", undefined, true), formattedCommandResponse)
app.post('/pathClean', auth, validateBody, validatePath, pathCommandAppend, afterPath(" -mtime +$ -type f -delete"), numberSwitch("$"), oneCommand(`sudo find ${process.env.filePath}`, "CLEAN PATH", undefined, true), formattedCommandResponse)

module.exports = app