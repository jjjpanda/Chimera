var express    = require('express')
const { startAllLiveStreams, processListMiddleware } = require('./lib/subprocess.js')

const app = express.Router();

if(process.env.storage == "on"){
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

module.exports = app