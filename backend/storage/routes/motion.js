require('dotenv').config()
var express    = require('express')
const { startMotion } = require('./lib/subprocess.js')

const app = express.Router();

startMotion();

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