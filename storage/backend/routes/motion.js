var express    = require('express')
const { startMotion } = require('./lib/subprocess.js')
const pm2 = require('pm2')
const { processListMiddleware } = require('lib')

const app = express.Router();

if(process.env.storage_ON === "true"){
    startMotion();
}

app.get("/status", (req, res, next) => {
    req.processName = "motion"
    next()
}, processListMiddleware(pm2))

module.exports = app