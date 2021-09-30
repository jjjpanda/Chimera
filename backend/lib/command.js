require('dotenv').config()
var path       = require('path')
var express    = require('express')

var app = express()

var {
    createProxyMiddleware
}              = require('http-proxy-middleware')

if(process.env.storageProxy == "on"){
    console.log("Converter 🔁 Proxied")

    app.use(/\/convert\/(.*Video|.*Zip|.*Process)|\/shared/, createProxyMiddleware((pathname, req) => {
        console.log(pathname, req.method)
        return (pathname.match(/\/.*Video|\/.*Zip|\/.*Process/) && req.method === 'POST') || pathname.match('/shared');
    }, {
        target: `http://${process.env.converterHost}:${process.env.PORT}/`,
    }))
}

if(process.env.scheduleProxy == "on"){
    console.log("Scheduler ⌚ Proxied")

    app.use(/\/task\/.*/, createProxyMiddleware((pathname, req) => {
        console.log(pathname, req.method)
        return (pathname.match(/\/task.*/) && req.method === 'POST');
    }, {
        target: `http://${process.env.schedulerHost}:${process.env.PORT}/`,
    }))
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/command', require('./subServers/command.js'))
app.use('/res', express.static(path.join(__dirname, '../../frontend/res')));
app.use('/', express.static(path.resolve(__dirname, "../../dist/"), {
    index: "app.html"
}))

module.exports = () => {

    console.log("Command 🎮 On")
    app.listen(process.env.commandPORT)

}