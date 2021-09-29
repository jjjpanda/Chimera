require('dotenv').config()
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var serveStatic        = require('serve-static')
var contentDisposition = require('content-disposition')
const {
    register
}              = require('./execTools/auth.js')

var app = express()

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

if(process.env.storage == "on"){
    console.log("Storage 📂 On")

    app.use('/convert', require('./subServers/storage.js'))
    
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

if(process.env.schedule == "on"){
    console.log("Schedule ⌚ On")

    app.use('/schedule', require('./subServers/schedule.js'))
}

if(process.env.command == "on"){
    console.log("Command 🎮 On")

    app.use('/command', require('./subServers/command.js'))
    app.use('/res', express.static(path.join(__dirname, '../../frontend/res')));
    app.use('/', express.static(path.resolve(__dirname, "../../dist/"), {
        index: "app.html"
    }))
}

module.exports = () => {
    
    register(
        () => app.listen(process.env.PORT), 
        () => console.log("😭 Server NOT started... 🥺")
    );

}