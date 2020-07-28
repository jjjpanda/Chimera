require('dotenv').config()
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var {
    createProxyMiddleware
}              = require('http-proxy-middleware')
var {
    convert,
    status,
    deleteVideo
}              = require('./converter.js')
var { 
    startMotion, 
    oneCommand 
}              = require('./commands.js')

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
    app.use(/\/convert|\/status|\/deleteVideo/, createProxyMiddleware((pathname, req) => {
        console.log(pathname, req.method)
        return (pathname.match(/\/convert|\/status|\/deleteVideo/) && req.method === 'POST');
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
    app.use('/shared', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
}

if(process.env.converter == "on"){
    console.log("Converter On")
    app.post('/convert', convert)
    app.post("/status", status)
    app.post("/deleteVideo", deleteVideo)
}

if(process.env.commandServer == "on"){
    console.log("Motion Controls On")

    app.post("/on", startMotion)
    app.post("/off", oneCommand(`sudo pkill motion`, "MOTION OFF"))
    app.post('/motion', oneCommand(`pidof -s motion`, "MOTION STATUS"))
    app.post('/kill', oneCommand(`sudo tmux kill-server`, "KILL SERVER"))
    app.post('/size', oneCommand(`du -sh ${process.env.sharedLocation}/shared/captures/`, "SIZE CHECK", true))
    app.post('/deleteVideos', oneCommand(`sudo rm -rf ${process.env.sharedLocation}/shared/captures/output*`, "DELETE VIDEOS"))
    app.post('/deleteImages', oneCommand(`sudo rm -rf ${process.env.sharedLocation}/shared/captures/`, "DELETE IMAGES", true))
    
    app.use('/', express.static(path.resolve(__dirname, "../frontend/"), {
        index: "index.html"
    }))
}

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}