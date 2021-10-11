var express    = require('express')
const { startMotion, processListMiddleware } = require('./lib/subprocess.js')

const app = express.Router();

if(process.env.storage == "on"){
    startMotion();
}

app.get("/status", (req, res, next) => {
    req.processName = "motion"
    next()
}, processListMiddleware)

module.exports = app