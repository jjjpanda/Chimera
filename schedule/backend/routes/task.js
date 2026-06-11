var express    = require("express")

var { validateBody, auth } = require("lib")
const { requireAdmin } = auth
var {
	validateStartableTask,
	validateId,
	startNewTask,
	stopTask,
	destroyTask,
	taskList,
	sendList,
	taskRuns
}              = require("./lib/scheduler.js")

const app = express.Router()

app.post("/start", requireAdmin, validateBody, validateStartableTask, taskList, startNewTask)
app.get("/list", taskList, sendList)
app.post("/stop", requireAdmin, validateBody, validateId, stopTask)
app.post("/destroy", requireAdmin, validateBody, validateId, destroyTask)
app.get("/runs", taskRuns)
app.get("/runs/:taskId", taskRuns)

module.exports = app