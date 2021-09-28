const express = require('express');

const app = express.Router();

app.post('/taskSchedule', validateBody, validateTaskRequest, validateTaskCron, destroyTask, scheduleTask, taskCheck)
app.post('/taskCheck', validateBody, validateTaskRequest, taskCheck)
app.post('/taskDestroy', validateBody, validateTaskRequest, destroyTask, taskCheck)

module.exports = app