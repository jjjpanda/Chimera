require('dotenv').config()
var express    = require('express')
const {exec} = require('child_process');

const app = express.Router();

const startLiveStream = (cameraNumber) => {
    const cameraURL = process.env[`camera${cameraNumber}`]
    exec(`mkdir ${process.env.filePath}shared/captures/live/${cameraNumber}`, () => {
        console.log(`\tStarting Live Stream ${cameraNumber}`)
        exec(`ffmpeg -i "${cameraURL}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${process.env.filePath}shared/captures/live/${cameraNumber}/video.m3u8`)
    })
}

console.log("\t▶ Starting Live Stream Processes")
exec(`mkdir ${process.env.filePath}shared/captures/live`, () => {
    let cameraIndex = 1
    while(`camera${cameraIndex}` in process.env){
        console.log(`\tFound Camera Index: ${cameraIndex}`)
        
        startLiveStream(cameraIndex)

        cameraIndex++
    }
})

app.post("/status", (req, res) => {
    exec(`ps -e | grep ffmpeg | grep rtsp`, (err, stdout, stderr) => {
        console.log(err, stdout, stderr)
        res.send({
            err,
            stdout,
            stdout
        })
    })
})

module.exports = app