var express    = require('express')
const path = require('path')
var {validateBody} = require('lib')

const app = express.Router();

//validateBody, validatePath, pathCommandAppend, oneCommand(`sudo du -sh ${process.env.storage_FILEPATH}`, "SIZE CHECK", undefined, true), formattedCommandResponse)
//validateBody, validatePath, pathCommandAppend, afterPath(' | wc -l'), oneCommand(`ls ${process.env.storage_FILEPATH}`, "FILE COUNT", undefined, true), formattedCommandResponse)
//validateBody, validatePath, pathCommandAppend, oneCommand(`sudo rm -rf ${process.env.storage_FILEPATH}`, "DELETE PATH", undefined, true), formattedCommandResponse)
//validateBody, validatePath, pathCommandAppend, afterPath(" -mtime +$ -type f -delete"), numberSwitch("$"), oneCommand(`sudo find ${process.env.storage_FILEPATH}`, "CLEAN PATH", undefined, true), formattedCommandResponse)

const validateCameraAndAppendToPath = (req, res, next) => {
    const {camera} = req.body
    if(camera){
        req.body.appendedPath = path.resolve(process.env.storage_FILEPATH, "./shared/captures/", camera)
        next()
    }
    else{
        res.send({error: "No camera number provided"})
    }
}

app.post('/pathSize', validateBody, validateCameraAndAppendToPath, (req, res) => res.send({working: "not really"})) 
app.post('/pathFileCount', validateBody, validateCameraAndAppendToPath, (req, res) => res.send({working: "not really"}))
app.post('/pathDelete', validateBody, validateCameraAndAppendToPath, (req, res) => res.send({working: "not really"})) 
app.post('/pathClean', validateBody, validateCameraAndAppendToPath, (req, res) => res.send({working: "not really"})) 

module.exports = app