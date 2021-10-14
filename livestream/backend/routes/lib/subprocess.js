const pm2 = require('pm2')
const process = require('process')
const mkdirp = require('mkdirp')

let processes = []

module.exports = {

    startAllLiveStreams: () => {
        console.log(`\t▶ Starting Live Stream Processes`)
        let cameraIndex = 1
        while(`livestream_CAMERA_URL_${cameraIndex}` in process.env){
            createLiveStreamDirectories(cameraIndex, startLiveStream)
            cameraIndex++
        }
    },

    processListMiddleware: (req, res) => {
        const {processName} = req
        processList((list) => {
            const processRunning = list.find((p) => {
                return p.name && p.name == processName
            }).length > 0
            res.send({processRunning})
        })
    }
}

const createLiveStreamDirectories = (cameraNumber, callback) => {
    mkdirp(`${process.env.livestream_FILEPATH}feed/${cameraNumber}`).then(made => {
        console.log(`\tSetup Directory: Cam ${cameraNumber} ◀`)
        callback(cameraNumber)
    })
}

const startLiveStream = (cameraNumber) => {
    const cameraURL = process.env[`livestream_CAMERA_URL_${cameraNumber}`]
    pm2.stop(`live_stream_cam_${cameraNumber}`, () => {
        pm2.start({
            script: `ffmpeg -loglevel quiet -i "${cameraURL}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${process.env.livestream_FILEPATH}feed/${cameraNumber}/video.m3u8`,
            name: `live_stream_cam_${cameraNumber}`
        }, (err, apps) => {
            if(err){
                console.log(`\tCouldn't Start Live Stream: Cam ${cameraNumber} ⚠`)
            }            
            else{
                console.log(`\tStarted Live Stream: Cam ${cameraNumber} ◀`)
            }
            processes.push({name: `live_stream_cam_${cameraNumber}`, log: `Live Stream ${cameraNumber} Off`})
        })
    })
}

const processList = (callback) => {
    pm2.list((err, list) => {
        callback(err ? [] : list)
    })
}

process.on('SIGINT', () => {
    processes.forEach((p) => {
        pm2.stop(p.name, () => {
            console.log(p.log)
        })
    })
})