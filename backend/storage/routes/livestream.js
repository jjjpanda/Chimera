require('dotenv').config()
var express    = require('express')
const { startAllLiveStreams } = require('./lib/subprocess.js')

const app = express.Router();

startAllLiveStreams();

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