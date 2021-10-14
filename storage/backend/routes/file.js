var express    = require('express')
var {validateBody} = require('lib')

const app = express.Router();

app.post('/pathSize', (req, res) => res.send({working: "not really"})) //validateBody, validatePath, pathCommandAppend, oneCommand(`sudo du -sh ${process.env.storage_FILEPATH}`, "SIZE CHECK", undefined, true), formattedCommandResponse)
app.post('/pathFileCount', (req, res) => res.send({working: "not really"})) //validateBody, validatePath, pathCommandAppend, afterPath(' | wc -l'), oneCommand(`ls ${process.env.storage_FILEPATH}`, "FILE COUNT", undefined, true), formattedCommandResponse)
app.post('/pathDelete', (req, res) => res.send({working: "not really"})) //validateBody, validatePath, pathCommandAppend, oneCommand(`sudo rm -rf ${process.env.storage_FILEPATH}`, "DELETE PATH", undefined, true), formattedCommandResponse)
app.post('/pathClean', (req, res) => res.send({working: "not really"})) //validateBody, validatePath, pathCommandAppend, afterPath(" -mtime +$ -type f -delete"), numberSwitch("$"), oneCommand(`sudo find ${process.env.storage_FILEPATH}`, "CLEAN PATH", undefined, true), formattedCommandResponse)

module.exports = app