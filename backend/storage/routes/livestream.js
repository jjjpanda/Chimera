require('dotenv').config()
var express    = require('express')
const {exec} = require('child_process');

const app = express.Router();

console.log("\t\t▶ Starting Live Stream Processes 👁")
exec(`motion -c ${process.env.motionConfPath}`)

exec(`mkdir ${process.env.filePath}shared/captures/live`, () => {
    let cameraIndex = 1
    while(`camera${cameraIndex}` in process.env){
        const cameraURL = process.env[`camera${cameraIndex}`]
        console.log(`\tFound Camera Index: ${cameraIndex}`)
        const i = cameraIndex
        exec(`mkdir ${process.env.filePath}shared/captures/live/${cameraIndex}`, () => {
            console.log(`\tStarting Live Stream ${cameraIndex}`)
            exec(`ffmpeg -i "${cameraURL}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${process.env.filePath}shared/captures/live/${i}/video.m3u8`)
        })
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