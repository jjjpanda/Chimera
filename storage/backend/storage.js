var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var serveStatic        = require('serve-static')
var contentDisposition = require('content-disposition')
const { handleServerStart } = require('lib')
const { startMotion, startAllLiveStreams } = require('./routes/lib/subprocess')

var app = express()

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/convert', require('./routes/convert.js'))

app.use('/file', require('./routes/file.js'))

app.use('/motion', require('./routes/motion.js'))
app.use('/livestream', require('./routes/livestream.js'))
    
app.use('/shared', serveStatic(path.join(process.env.filePath, 'shared'), {
        index: false,
        setHeaders: (res, path) => {
            res.setHeader('Content-Disposition', contentDisposition(path))
        }
    }), express.static(path.join(process.env.filePath, 'shared')), serveIndex(path.join(process.env.filePath, 'shared'), {
        icons: true,
        stylesheet: path.resolve(__dirname, './routes/lib/templates/fileStyle.css'),
        template: path.resolve(__dirname, './routes/lib/templates/fileTemplate.html')
    })
)

module.exports = (isOn) => {
    const onLog = () => {
        console.log(`📂 Storage On ▶ PORT ${process.env.storagePORT}`)
        console.log(`\t▶ Converter Routes:\t /converter`)
        console.log(`\t▶ Motion Routes:\t /motion`)
        console.log(`\t▶ Live Stream Routes:\t /livestream`)
        console.log(`\t▶ Shared File Routes:\t /shared`)
    }
    const offLog = () => {
        console.log(`📂 Storage Off ❌`)
    }

    if(isOn){
        startMotion();
        startAllLiveStreams();
    }
    handleServerStart(app, process.env.storagePORT, isOn, onLog, offLog, process.env.storageProxy == "on" ? process.env.commandHost : undefined)

}