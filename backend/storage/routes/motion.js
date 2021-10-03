require('dotenv').config()
var express    = require('express')
const {exec} = require('child_process');

const app = express.Router();

console.log("\t\t▶ 🚶‍♂️ Starting Motion Process")
exec(`motion -c ${process.env.motionConfPath}`)

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