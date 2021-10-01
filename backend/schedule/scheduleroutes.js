require('dotenv').config()
var express    = require('express')
var { 
    validateBody 
}              = require('../lib/validators.js')
var {
    validateTaskRequest,
    validateTaskCron,
    scheduleTask,
    destroyTask,
    taskCheck
}              = require('../schedule/scheduler.js')

const app = express.Router();

app.post('/schedule', validateBody, validateTaskRequest, validateTaskCron, destroyTask, scheduleTask, taskCheck)
app.post('/check', validateBody, validateTaskRequest, taskCheck)
app.post('/destroy', validateBody, validateTaskRequest, destroyTask, taskCheck)

module.exports = app