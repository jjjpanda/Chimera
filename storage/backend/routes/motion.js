var express    = require('express')
const { startMotion } = require('./lib/subprocess.js')
const pm2 = require('pm2')
const { subprocess } = require('lib')

const app = express.Router();

startMotion();

app.get("/status", (req, res, next) => {
    req.processName = "motion"
    next()
}, subprocess.processListMiddleware(pm2))

module.exports = app