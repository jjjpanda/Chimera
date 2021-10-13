var path       = require('path')
var express    = require('express')
const { handleServerStart, auth } = require('lib')
var {
    createProxyMiddleware
}              = require('http-proxy-middleware')

var app = express()

app.use(require('cookie-parser')())
app.use(auth.auth)

if(process.env.storageProxy == "on"){
    console.log("📂 Storage Proxied ◀")
    const convertRoutesRegex = /\/convert\/(.*Video|.*Zip|.*Process)|\/file\/path.*|\/shared|\/livestream|\/motion/
    app.use(convertRoutesRegex, createProxyMiddleware((pathname, req) => {
        //console.log(pathname, req.method)
        return (pathname.match(convertRoutesRegex) && req.method === 'POST') || pathname.match('/shared');
    }, {
        target: `http://${process.env.storageHost}:${process.env.storagePORT}/`,
        logLevel: "silent"
    }))
}

if(process.env.scheduleProxy == "on"){
    console.log("⌚ Scheduler Proxied ◀")
    const scheduleRoutesRegex = /\/task\/.*/
    app.use(scheduleRoutesRegex, createProxyMiddleware((pathname, req) => {
        //console.log(pathname, req.method)
        return (pathname.match(scheduleRoutesRegex) && req.method === 'POST');
    }, {
        target: `http://${process.env.scheduleHost}:${process.env.schedulePORT}/`,
        logLevel: "silent",
        //headers: req.headers,
        //auth: "" //user:password
    }))
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/authorization', require('./routes/authorization.js'))
app.use('/res', express.static(path.join(__dirname, '../frontend/res')));
app.use('/', express.static(path.resolve(__dirname, "../dist/"), {
    index: "app.html"
}))

module.exports = (isOn) => {
    const onLog = () => {
        console.log(`🎮 Command On ▶ PORT ${process.env.commandPORT}`)
        console.log(`\t▶ Authorization Routes:\t /authorization`)
        console.log(`\t▶ Resource Routes:\t /res`)
        console.log(`\t▶ Web App Launched`)
    }
    const offLog = () => {
        console.log(`🎮 Command Off ❌`)
    }
    
    auth.register(() => {
        handleServerStart(app, process.env.commandPORT, isOn, onLog, offLog)
    }, (err) => {
        console.log(err)
        offLog()
    })
}