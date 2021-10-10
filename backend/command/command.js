require('dotenv').config()
var path       = require('path')
var express    = require('express')
const handle = require('../lib/handle.js')

var app = express()

const {auth} = require('../lib/auth');

var {
    createProxyMiddleware
}              = require('http-proxy-middleware')

if(process.env.storageProxy == "on"){
    console.log("📂 Storage Proxied ◀")
    const convertRoutesRegex = /\/convert\/(.*Video|.*Zip|.*Process)|\/file\/path.*|\/shared|\/livestream|\/motion/
    app.use(convertRoutesRegex, [auth, createProxyMiddleware((pathname, req) => {
        //console.log(pathname, req.method)
        return (pathname.match(convertRoutesRegex) && req.method === 'POST') || pathname.match('/shared');
    }, {
        target: `http://${process.env.storageHost}:${process.env.storagePORT}/`,
        logLevel: "silent"
    })])
}

if(process.env.scheduleProxy == "on"){
    console.log("⌚ Scheduler Proxied ◀")
    const scheduleRoutesRegex = /\/task\/.*/
    app.use(scheduleRoutesRegex, [auth, createProxyMiddleware((pathname, req) => {
        //console.log(pathname, req.method)
        return (pathname.match(scheduleRoutesRegex) && req.method === 'POST');
    }, {
        target: `http://${process.env.scheduleHost}:${process.env.schedulePORT}/`,
        logLevel: "silent"
    })])
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/authorization', require('./routes/authorization.js'))
app.use('/res', express.static(path.join(__dirname, '../../frontend/res')));
app.use('/', express.static(path.resolve(__dirname, "../../dist/"), {
    index: "app.html"
}))

module.exports = () => {

    handle(app, process.env.commandPORT, () => {
        console.log(`🎮 Command On ▶ PORT ${process.env.commandPORT}`)
        console.log(`\t▶ Authorization Routes:\t /authorization`)
        console.log(`\t▶ Resource Routes:\t /res`)
        console.log(`\t▶ Web App Launched`)
    }, () => {
        console.log(`🎮 Command Off ❌`)
    })

}