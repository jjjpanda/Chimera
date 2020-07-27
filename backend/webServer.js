require('dotenv').config()
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var proxy      = require('http-proxy-middleware').createProxyMiddleware
var commands   = require('./commands.js')

var app = express()

//PROXY
if(process.env.fileServer == "proxy"){
    console.log("File Server Proxied")
    app.use("/shared", proxy((pathname, req) => {
        return pathname.match('/shared');
    },{
        target: `http://${process.env.host}:${process.env.PORT}/`,
        logLevel: 'debug',
    }))
}

if(process.env.converter == "proxy"){
    console.log("Converter Proxied")
    app.use(/\/convert|\/status/, proxy((pathname, req) => {
        console.log(pathname, req.body, req.method)
        return (pathname.match(/\/convert|\/status/) && req.method === 'POST');
    }, {
        target: `http://${process.env.host}:${process.env.PORT}/`,
        logLevel: 'debug',
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
    app.post('/convert', require('./converter.js').convert)
    app.post("/status", require('./converter.js').status )
}

if(process.env.commandServer == "on"){
    console.log("Motion Controls On")
    app.post("/on", commands.startMotion)
    app.post("/off", commands.oneCommand(`sudo pkill motion`, "MOTION OFF"))
    app.post('/motion', commands.oneCommand(`pidof -s motion`, "MOTION STATUS"))
    app.post('/kill', commands.oneCommand(`sudo tmux kill-server`, "KILL SERVER"))
    app.use('/', express.static(path.resolve(__dirname, "../frontend/"), {
        index: "index.html"
    }))
}

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}