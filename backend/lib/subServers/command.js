require('dotenv').config()
var express    = require('express')
var { 
    validateBody 
}              = require('../tools/validators.js')
var { 
    startMotion, 
    oneCommand,
    afterPath,
    validatePath,
    numberSwitch,
    formattedCommandResponse,
    pathCommandAppend
}              = require('../execTools/commands.js')
const {
    auth,
    login
}              = require('../execTools/auth.js')

const app = express.Router();

app.post('/motionStart', startMotion, formattedCommandResponse)
app.post('/motionStatus', oneCommand(`ps -e | grep motion`, "MOTION STATUS"), formattedCommandResponse)
app.post('/motionStop', oneCommand(`sudo pkill motion`, "MOTION OFF"), formattedCommandResponse)

app.post('/serverUpdate', oneCommand(`sudo git pull`, "UPDATING SERVER", `${process.env.filePath}shared/MotionPlayback`), formattedCommandResponse)
app.post('/serverStatus', oneCommand(`ps -e | grep node`, "SERVER STATUS"), formattedCommandResponse)
app.post('/serverInstall', oneCommand(`npm install --no-progress && npm run buildNoProgress`, "INSTALLING SERVER", `${process.env.filePath}shared/MotionPlayback`), formattedCommandResponse)
app.post('/serverStop', oneCommand(`sudo pkill node`, "SERVER STOP"), formattedCommandResponse)

app.post('/pathSize', validateBody, validatePath, pathCommandAppend, oneCommand(`sudo du -sh ${process.env.filePath}`, "SIZE CHECK", undefined, true), formattedCommandResponse)
app.post('/pathFileCount', validateBody, validatePath, pathCommandAppend, afterPath(' | wc -l'), oneCommand(`ls ${process.env.filePath}`, "FILE COUNT", undefined, true), formattedCommandResponse)
app.post('/pathDelete', validateBody, validatePath, pathCommandAppend, oneCommand(`sudo rm -rf ${process.env.filePath}`, "DELETE PATH", undefined, true), formattedCommandResponse)
app.post('/pathClean', validateBody, validatePath, pathCommandAppend, afterPath(" -mtime +$ -type f -delete"), numberSwitch("$"), oneCommand(`sudo find ${process.env.filePath}`, "CLEAN PATH", undefined, true), formattedCommandResponse)

app.post('/login', validateBody, login)
app.post('/verify', auth, (req, res) => {
    res.json({error: false, token: req.header('authorization')})
})

module.exports = app