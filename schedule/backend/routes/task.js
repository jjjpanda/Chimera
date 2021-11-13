var express    = require('express');

var { validateBody } = require('lib')
var {
    validateStartableTask,
    validateTaskCron,
    validateId,
    startTask,
    stopTask,
    destroyTask,
    taskList,
    sendList
}              = require('./lib/scheduler.js')

const app = express.Router();

app.post("/start", validateBody, validateStartableTask, validateTaskCron, startTask)
app.get('/list', taskList, sendList)
app.post("/stop", validateBody, validateId, stopTask)
app.post("/delete", validateBody, validateId, destroyTask)

module.exports = app