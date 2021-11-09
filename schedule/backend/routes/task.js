var express    = require('express');

var { validateBody, tempMiddleware } = require('lib')
var {
    validateTaskRequest,
    validateTaskCron,
    scheduleTask,
    destroyTask,
    taskCheck,
    taskList
}              = require('./lib/scheduler.js')

const app = express.Router();

app.post('/schedule', tempMiddleware.deprecation, validateBody, validateTaskRequest, validateTaskCron, destroyTask, scheduleTask, taskCheck)
app.post('/check', tempMiddleware.deprecation,  validateBody, validateTaskRequest, taskCheck)
app.post('/destroy', tempMiddleware.deprecation,  validateBody, validateTaskRequest, destroyTask, taskCheck)

app.get('/list', tempMiddleware.construction, taskList)

module.exports = app