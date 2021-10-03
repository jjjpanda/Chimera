require('dotenv').config()
var express    = require('express')
const {exec} = require('child_process');

const app = express.Router();

console.log("STARTING MOTION 📸▶🚶‍♂️")
exec(`motion -c ${process.env.motionConfPath}`)

exec(`mkdir ${process.env.filePath}shared/captures/live`, () => {
    let cameraIndex = 1
    while(process.env[`camera${cameraIndex}`] != undefined){
        const cameraURL = process.env[`camera${cameraIndex}`]
        console.log(`FOUND CAMERA INDEX: ${cameraIndex}`)
        exec(`mkdir ${process.env.filePath}shared/captures/live/${cameraIndex}`, () => {
            exec(`ffmpeg -i "${cameraURL}" -fflags flush_packets -max_delay 1 -flags -global_header -hls_time 1 -hls_list_size 3 -segment_wrap 10 -hls_flags delete_segments -vcodec copy -y ${process.env.filePath}shared/captures/live/${cameraIndex}/video.m3u8`)
        })
        cameraIndex++
    }
})

app.post("/status", (req, res) => {
    exec(`ps -e | grep motion`, (err, stdout, stderr) => {
        console.log(err, stdout, stderr)
        res.send({
            err,
            stdout,
            stdout
        })
    })
})

module.exports = app