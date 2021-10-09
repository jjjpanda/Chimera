require('dotenv').config()
const {exec} = require('child_process');
const pm2 = require('pm2')

module.exports = {
    startMotion: () => {
        pm2.start({
            script: `motion -c ${process.env.motionConfPath}`,
            name: "motion"
        }, (err, apps) => {
            
        })
    },

    createLiveStreamDirectories: (cameraNumber, callback) => {
        pm2.start({
            script: `mkdir -p ${process.env.filePath}shared/captures/live/${cameraNumber}`
        }, (err, apps) => {
            callback(cameraNumber)
        })
    },

    startLiveStream: (cameraNumber) => {
        console.log(`\tStarting Live Stream ${cameraNumber}`)
        const cameraURL = process.env[`camera${cameraNumber}`]
        pm2.start({
            script: `ffmpeg -i "${cameraURL}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${process.env.filePath}shared/captures/live/${cameraNumber}/video.m3u8`
        }, (err, apps) => {
            
        })
    }
}

console.log("\t▶ Starting Motion Process")

console.log("\t▶ Starting Live Stream Processes")


let cameraIndex = 1
while(`camera${cameraIndex}` in process.env){
    console.log(`\tFound Camera Index: ${cameraIndex}`)
    
    startLiveStream(cameraIndex)

    cameraIndex++
}


