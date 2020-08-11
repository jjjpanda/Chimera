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
    validateRequest,
    validateID,
}              = require('./converter/converter.js')
var {
    createVideo,
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
    validatePath,
    formattedCommandResponse,
    pathCommandAppend
}              = require('./commands/commands.js')

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
        'setHeaders': (res, path) => {
            res.setHeader('Content-Disposition', contentDisposition(path))
        },
    }),
    express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {
        'icons': true,
        stylesheet: path.resolve(__dirname, '../templates/fileStyle.css'),
        template: path.resolve(__dirname, '../templates/fileTemplate.html')
    }))
}

if(process.env.converter == "on"){
    console.log("Converter On")
    /* app.post('/convert', validateVideoDetails, convert)
    app.post("/status", validateID, status)
    app.post("/deleteVideo", validateID, deleteVideo) */

    app.post('/createVideo', validateRequest, createVideo)

    app.post('/createZip', validateRequest, createZip)

    app.post('/statusProcess', validateID, statusProcess)
    app.post('/cancelProcess', validateID, cancelProcess)
    app.post('/listProcess', listProcess)
    app.post('/deleteProcess', validateID, deleteProcess)
}

if(process.env.commandServer == "on"){
    console.log("Motion Controls On")

    app.post('/motionStart', startMotion, formattedCommandResponse)
    app.post('/motionStatus', oneCommand(`ps -e | grep motion`, "MOTION STATUS"), formattedCommandResponse)
    app.post('/motionStop', oneCommand(`sudo pkill motion`, "MOTION OFF"), formattedCommandResponse)
    
    app.post('/serverUpdate', oneCommand(`sudo git pull`, "UPDATING SERVER", `${process.env.sharedLocation}shared/MotionPlayback`), formattedCommandResponse)
    app.post('/serverStatus', oneCommand(`ps -e | grep node`, "SERVER STATUS"), formattedCommandResponse)
    app.post('/serverInstall', oneCommand(`npm install --no-progress`, "INSTALLING SERVER", `${process.env.sharedLocation}shared/MotionPlayback`), formattedCommandResponse)
    app.post('/serverStop', oneCommand(`sudo pkill node`, "SERVER STOP"), formattedCommandResponse)
    
    app.post('/pathSize', validatePath, pathCommandAppend, oneCommand(`du -sh ${process.env.sharedLocation}`, "SIZE CHECK", undefined, true), formattedCommandResponse)
    app.post('/pathDelete', validatePath, pathCommandAppend, oneCommand(`sudo rm -rf ${process.env.sharedLocation}`, "DELETE PATH", undefined, true), formattedCommandResponse)
 
    app.use('/legacy', express.static(path.resolve(__dirname, "../../frontend"), {
        index: "index.html"
    }))

    app.use('/', express.static(path.resolve(__dirname, "../../dist/"), {
        index: "index.html"
    }))
}

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}