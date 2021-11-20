var express    = require("express")

var { validateBody } = require("lib")
var {
	validateStartableTask,
	validateId,
	startNewTask,
	stopTask,
	destroyTask,
	taskList,
	sendList
}              = require("./lib/scheduler.js")

const app = express.Router()

app.post("/start", validateBody, validateStartableTask, taskList, startNewTask)
app.get("/list", taskList, sendList)
app.post("/stop", validateBody, validateId, stopTask)
app.post("/destroy", validateBody, validateId, destroyTask)

module.exports = app