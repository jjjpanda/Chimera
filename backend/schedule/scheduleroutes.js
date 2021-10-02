require('dotenv').config()
var express    = require('express');
const {auth} = require('../lib/auth.js');
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

app.post('/schedule', auth, validateBody, validateTaskRequest, validateTaskCron, destroyTask, scheduleTask, taskCheck)
app.post('/check', auth, validateBody, validateTaskRequest, taskCheck)
app.post('/destroy', auth, validateBody, validateTaskRequest, destroyTask, taskCheck)

module.exports = app