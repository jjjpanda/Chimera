require('dotenv').config()
const pm2 = require('pm2')

module.exports = {
    startMotion: () => {
        console.log("\t▶ Starting Motion Process")
        pm2.start({
            script: `motion -c ${process.env.motionConfPath}`,
            name: "motion"
        }, (err, apps) => {
            
        })
    },

    startAllLiveStreams: () => {
        console.log(`\t▶ Starting Live Stream Processes`)
        let cameraIndex = 1
        while(`camera${cameraIndex}` in process.env){
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
    pm2.start({
        script: `mkdir -p ${process.env.filePath}shared/captures/live/${cameraNumber}`,
        name: `directory_creation_cam_${cameraNumber}`
    }, (err, apps) => {
        console.log(`\tSetup Directory: Cam ${cameraNumber} ◀`)
        callback(cameraNumber)
    })
}

const startLiveStream = (cameraNumber) => {
    const cameraURL = process.env[`camera${cameraNumber}`]
    pm2.start({
        script: `ffmpeg -i "${cameraURL}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${process.env.filePath}shared/captures/live/${cameraNumber}/video.m3u8`,
        name: `live_stream_cam_${cameraNumber}`
    }, (err, apps) => {
        console.log(`\tStarted Live Stream: Cam ${cameraNumber} ◀`)
    })
}

const processList = (callback) => {
    pm2.list((err, list) => {
        callback(err ? [] : list)
    })
}