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
}              = require('./execTools/commands.js')
var {
    validateTaskRequest,
    validateTaskCron,
    scheduleTask,
    destroyTask,
    taskCheck
}              = require('./execTools/scheduler.js')

var app = express()

//PROXY
if(process.env.mediaServer == "proxy"){
    console.log("Media Server 📺 Controller Proxy")

    app.use(/\/media.*/, createProxyMiddleware((pathname, req) => {
        console.log(pathname, req.method)
        return (pathname.match(/\/media.*/) && req.method === 'POST');
    }, {
        target: `http://${process.env.mediaHost}:${process.env.PORT}/`,
    }))
}

if(process.env.webdav == "proxy"){
    console.log("WebDAV 📁 Controller Proxy")
    
    app.use(/\/webdav.*/, createProxyMiddleware((pathname, req) => {
        console.log(pathname, req.method)
        return (pathname.match(/\/webdav.*/) && req.method === 'POST');
    }, {
        target: `http://${process.env.webdavHost}:${process.env.PORT}/`,
    }))
}

if(process.env.converter == "proxy"){
    console.log("Converter 🔁 Proxied")

    app.use(/\/.*Video|\/.*Zip|\/.*Process|\/shared/, createProxyMiddleware((pathname, req) => {
        console.log(pathname, req.method)
        return (pathname.match(/\/.*Video|\/.*Zip|\/.*Process/) && req.method === 'POST') || pathname.match('/shared');
    }, {
        target: `http://${process.env.converterHost}:${process.env.PORT}/`,
    }))
}

if(process.env.scheduler == "proxy"){
    console.log("Scheduler ⌚ Proxied")

    app.use(/\/task.*/, createProxyMiddleware((pathname, req) => {
        console.log(pathname, req.method)
        return (pathname.match(/\/task.*/) && req.method === 'POST');
    }, {
        target: `http://${process.env.schedulerHost}:${process.env.PORT}/`,
    }))
}

//BODY PARSER
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())

//NON PROXY
if(process.env.mediaServer == "on"){
    console.log("Media Server 📺 Controller On")

    const media = require('./subServers/media.js')
    
    app.post('/mediaOn', media.check(true, true), media.start, media.check(false))
    app.post('/mediaStatus', media.check(false))
    app.post('/mediaOff', media.check(true, false), media.stop, media.check(false))
}

if(process.env.webdav == "on"){
    console.log("WebDAV 📁 Controller On")
    
    const webDav = require('./subServers/webDav.js')

    app.post('/webdavOn', webDav.check(true, true), webDav.start, webDav.check(false))
    app.post('/webdavStatus', webDav.check(false))
    app.post('/webdavOff', webDav.check(true, false), webDav.stop, webDav.check(false))
}

if(process.env.converter == "on"){
    console.log("Converter 🔁 On")

    app.post('/createVideo', validateBody, validateRequest, createVideo)
    app.post('/listFramesVideo', validateBody, validateRequest, listOfFrames)

    app.post('/createZip', validateBody, validateRequest, createZip)

    app.post('/statusProcess', validateBody, validateID, statusProcess)
    app.post('/cancelProcess', validateBody, validateID, cancelProcess)
    app.post('/listProcess', listProcess)
    app.post('/deleteProcess', validateBody, validateID, deleteProcess)

    app.use('/shared', serveStatic(path.join(process.env.filePath, 'shared'), {
        index: false,
        setHeaders: (res, path) => {
            res.setHeader('Content-Disposition', contentDisposition(path))
        },
    }),
    express.static(path.join(process.env.filePath, 'shared')), serveIndex(path.join(process.env.filePath, 'shared'), {
        icons: true,
        stylesheet: path.resolve(__dirname, '../templates/fileStyle.css'),
        template: path.resolve(__dirname, '../templates/fileTemplate.html')
    }))
}

if(process.env.scheduler == "on"){
    console.log("Scheduler ⌚ On")

    app.post('/taskSchedule', validateBody, validateTaskRequest, validateTaskCron, destroyTask, scheduleTask, taskCheck)
    app.post('/taskCheck', validateBody, validateTaskRequest, taskCheck)
    app.post('/taskDestroy', validateBody, validateTaskRequest, destroyTask, taskCheck)
}

if(process.env.commander == "on"){
    console.log("Motion Controls 🎮 On")

    //scheduling requests with nodecron

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