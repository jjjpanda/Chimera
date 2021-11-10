var express    = require('express');

var { validateBody, tempMiddleware } = require('lib')
var {
    validateTaskRequest,
    validateTaskCron,
    validateId,
    scheduleTask,
    stopTask,
    destroyTask,
    taskCheck,
    taskList,
    sendList
}              = require('./lib/scheduler.js')

const app = express.Router();

app.post('/schedule', tempMiddleware.deprecation, validateBody, validateTaskRequest, validateTaskCron, destroyTask, scheduleTask, taskCheck)
app.post('/check', tempMiddleware.deprecation,  validateBody, validateTaskRequest, taskCheck)
app.post('/destroy', tempMiddleware.deprecation,  validateBody, validateTaskRequest, destroyTask, taskCheck)

app.post("/create", tempMiddleware.construction, validateBody, validateTaskRequest, validateTaskCron, scheduleTask)
app.get('/list', tempMiddleware.construction, taskList, sendList)
app.post("/stop", tempMiddleware.construction, validateBody, validateId, stopTask)
app.post("/delete", tempMiddleware.construction, validateBody, validateId, destroyTask)

module.exports = app