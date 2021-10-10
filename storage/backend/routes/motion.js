require('dotenv').config()
var express    = require('express')
const { startMotion, processListMiddleware } = require('./lib/subprocess.js')

const app = express.Router();

startMotion();

app.get("/status", (req, res, next) => {
    req.processName = "motion"
    next()
}, processListMiddleware)

module.exports = app