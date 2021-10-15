var express    = require('express')
const path = require('path')
var serveStatic        = require('serve-static')
var contentDisposition = require('content-disposition')
const { startAllLiveStreams } = require('./lib/subprocess.js')
const pm2 = require('pm2')
const { subprocess } = require('lib')

const app = express.Router();

if(process.env.livestream_ON === "true"){
    startAllLiveStreams();
}

app.get("/status", (req, res, next) => {
    const {camera} = req.query;
    if(camera){
        req.processName = `live_stream_cam_${camera}`
    }
    else{
        req.processName = `live_stream_cam`
    }
    next()
}, subprocess.processListMiddleware(pm2))

app.use('/feed', serveStatic(path.join(process.env.livestream_FILEPATH, 'feed'), {
    index: false,
    setHeaders: (res, path) => {
        res.setHeader('Content-Disposition', contentDisposition(path))
    }
})
)


module.exports = app