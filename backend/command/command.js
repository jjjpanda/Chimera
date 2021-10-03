require('dotenv').config()
var path       = require('path')
var express    = require('express')

var app = express()

const {auth} = require('../lib/auth');

var {
    createProxyMiddleware
}              = require('http-proxy-middleware')

if(process.env.storageProxy == "on"){
    console.log("📂 Storage Proxied ◀")

    app.use(/\/convert\/(.*Video|.*Zip|.*Process|path.*)|\/shared|\/motion/, [auth, createProxyMiddleware((pathname, req) => {
        //console.log(pathname, req.method)
        return (pathname.match(/\/convert\/(.*Video|.*Zip|.*Process|path.*)|\/shared|\/motion/) && req.method === 'POST') || pathname.match('/shared');
    }, {
        target: `http://${process.env.storageHost}:${process.env.storagePORT}/`,
        logLevel: "silent"
    })])
}

if(process.env.scheduleProxy == "on"){
    console.log("⌚ Scheduler Proxied ◀")

    app.use(/\/schedule\/.*/, [auth, createProxyMiddleware((pathname, req) => {
        //console.log(pathname, req.method)
        return (pathname.match(/\/schedule\/.*/) && req.method === 'POST');
    }, {
        target: `http://${process.env.scheduleHost}:${process.env.schedulePORT}/`,
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

    app.listen(process.env.commandPORT, () => {
        console.log(`🎮 Command On ▶ ${process.env.commandPORT}`)
        console.log(`\t▶ Authorization Routes:\t /authorization`)
        console.log(`\t▶ Resource Routes:\t /res`)
        console.log(`\t▶ Web App Launched`)
    })

}