var express    = require('express')
const path = require('path')
var serveStatic        = require('serve-static')
var contentDisposition = require('content-disposition')
const { startAllLiveStreams, processListMiddleware } = require('./lib/subprocess.js')

const app = express.Router();

if(process.env.livestream_ON === "true"){
    startAllLiveStreams();
}

app.get("/status", (req, res, next) => {
    const {camera} = req.query;
    if(camera){
        req.processName = `live_stream_cam_${camera}`
        next()
    }
    else{
        next('list')
    }
}, processListMiddleware)

app.get('/list', (req, res) => {
    processList((list) => {
        const liveStreamProcessList = list.filter((p) => {
            return p.name && p.name.includes(`live_stream_cam_`)
        }).map(({name, status}) => ({name , status}))
        res.send({liveStreamProcessList})
    })
})

app.use('/feed', serveStatic(path.join(process.env.livestream_FILEPATH, 'feed'), {
    index: false,
    setHeaders: (res, path) => {
        res.setHeader('Content-Disposition', contentDisposition(path))
    }
})
)


module.exports = app