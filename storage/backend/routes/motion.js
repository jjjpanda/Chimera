var express    = require('express')
const { processListMiddleware } = require('./lib/subprocess.js')

const app = express.Router();

app.get("/status", (req, res, next) => {
    req.processName = "motion"
    next()
}, processListMiddleware)

module.exports = app