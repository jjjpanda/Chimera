require('dotenv').config()
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var serveStatic        = require('serve-static')
var contentDisposition = require('content-disposition')
var {
    createProxyMiddleware
}              = require('http-proxy-middleware')
var { 
    validateBody 
}              = require('./tools/validators.js')
var {
    validateRequest,
    validateID,
}              = require('./converter/converter.js')
var {
    createVideo,
    listOfFrames,
}              = require('./converter/video.js')
var {
    createZip,
}              = require('./converter/zip.js')
var {
    statusProcess,
    cancelProcess,
    listProcess,
    deleteProcess
}              = require('./converter/process.js')
var { 
    startMotion, 
    oneCommand,
    afterPath,
    validatePath,
    numberSwitch,
    formattedCommandResponse,
    pathCommandAppend
}              = require('./commands/commands.js')
var {
    validateTaskRequest,
    validateTaskCron,
    scheduleTask,
    destroyTask,
    taskCheck
}              = require('./commands/scheduler.js')

var app = express()

//PROXY
if(process.env.fileServer == "proxy"){
    console.log("File Server Proxied")
    app.use("/shared", createProxyMiddleware((pathname, req) => {
        return pathname.match('/shared');
    },{
        target: `http://${process.env.host}:${process.env.PORT}/`,
    }))
}

if(process.env.converter == "proxy"){
    console.log("Converter Proxied")
    app.use(/\/.*Video|\/.*Zip|\/.*Process/, createProxyMiddleware((pathname, req) => {
        console.log(pathname, req.method)
        return (pathname.match(/\/.*Video|\/.*Zip|\/.*Process/) && req.method === 'POST');
    }, {
        target: `http://${process.env.host}:${process.env.PORT}/`,
    }))
}

//BODY PARSER
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())

//NON PROXY

if(process.env.fileServer == "on"){
    console.log("File Server On")
    app.use('/shared', serveStatic(path.join(process.env.filePath), {
        index: false,
        setHeaders: (res, path) => {
            res.setHeader('Content-Disposition', contentDisposition(path))
        },
    }),
    express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {
        icons: true,
        stylesheet: path.resolve(__dirname, '../templates/fileStyle.css'),
        template: path.resolve(__dirname, '../templates/fileTemplate.html')
    }))
}

if(process.env.converter == "on"){
    console.log("Converter On")

    app.post('/createVideo', validateBody, validateRequest, createVideo)
    app.post('/listFramesVideo', validateBody, validateRequest, listOfFrames)

    app.post('/createZip', validateBody, validateRequest, createZip)

    app.post('/statusProcess', validateBody, validateID, statusProcess)
    app.post('/cancelProcess', validateBody, validateID, cancelProcess)
    app.post('/listProcess', listProcess)
    app.post('/deleteProcess', validateBody, validateID, deleteProcess)
}

if(process.env.commandServer == "on"){
    console.log("Motion Controls On")

    //scheduling requests with nodecron

    app.post('/motionStart', startMotion, formattedCommandResponse)
    app.post('/motionStatus', oneCommand(`ps -e | grep motion`, "MOTION STATUS"), formattedCommandResponse)
    app.post('/motionStop', oneCommand(`sudo pkill motion`, "MOTION OFF"), formattedCommandResponse)
    
    app.post('/serverUpdate', oneCommand(`sudo git pull`, "UPDATING SERVER", `${process.env.sharedLocation}shared/MotionPlayback`), formattedCommandResponse)
    app.post('/serverStatus', oneCommand(`ps -e | grep node`, "SERVER STATUS"), formattedCommandResponse)
    app.post('/serverInstall', oneCommand(`npm install --no-progress && npm run buildNoProgress`, "INSTALLING SERVER", `${process.env.sharedLocation}shared/MotionPlayback`), formattedCommandResponse)
    app.post('/serverStop', oneCommand(`sudo pkill node`, "SERVER STOP"), formattedCommandResponse)
    
    app.post('/pathSize', validateBody, validatePath, pathCommandAppend, oneCommand(`sudo du -sh ${process.env.sharedLocation}`, "SIZE CHECK", undefined, true), formattedCommandResponse)
    app.post('/pathFileCount', validateBody, validatePath, pathCommandAppend, afterPath(' | wc -l'), oneCommand(`ls ${process.env.sharedLocation}`, "FILE COUNT", undefined, true), formattedCommandResponse)
    app.post('/pathDelete', validateBody, validatePath, pathCommandAppend, oneCommand(`sudo rm -rf ${process.env.sharedLocation}`, "DELETE PATH", undefined, true), formattedCommandResponse)
    app.post('/pathClean', validateBody, validatePath, pathCommandAppend, afterPath(" -mtime +$ -type f -delete"), numberSwitch("$"), oneCommand(`sudo find ${process.env.sharedLocation}`, "CLEAN PATH", undefined, true), formattedCommandResponse)

    app.post('/scheduleTask', validateBody, validateTaskRequest, validateTaskCron, scheduleTask, taskCheck)
    app.post('/checkTask', validateBody, validateTaskRequest, taskCheck)
    app.post('/destroyTask', validateBody, validateTaskRequest, destroyTask, taskCheck)

    app.use('/legacy', express.static(path.resolve(__dirname, "../../frontend"), {
        index: "legacy.html"
    }))

    app.use('/', express.static(path.resolve(__dirname, "../../dist/"), {
        index: "app.html"
    }))
}

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}