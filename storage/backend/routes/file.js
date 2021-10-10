var express    = require('express')
var {validateBody} = require('lib')

const app = express.Router();

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
}              = require('./lib/commands.js')

app.post('/pathSize', validateBody, validatePath, pathCommandAppend, oneCommand(`sudo du -sh ${process.env.filePath}`, "SIZE CHECK", undefined, true), formattedCommandResponse)
app.post('/pathFileCount', validateBody, validatePath, pathCommandAppend, afterPath(' | wc -l'), oneCommand(`ls ${process.env.filePath}`, "FILE COUNT", undefined, true), formattedCommandResponse)
app.post('/pathDelete', validateBody, validatePath, pathCommandAppend, oneCommand(`sudo rm -rf ${process.env.filePath}`, "DELETE PATH", undefined, true), formattedCommandResponse)
app.post('/pathClean', validateBody, validatePath, pathCommandAppend, afterPath(" -mtime +$ -type f -delete"), numberSwitch("$"), oneCommand(`sudo find ${process.env.filePath}`, "CLEAN PATH", undefined, true), formattedCommandResponse)

module.exports = app