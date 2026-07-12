const cron = require("node-cron")

let scheduledTaskConfigs = {}
let scheduledTask = {}

module.exports = (io) => ({
	createTask: (taskObject) => {
		if (scheduledTask[taskObject.id]) scheduledTask[taskObject.id].destroy()
		scheduledTaskConfigs[taskObject.id] = taskObject
		scheduledTask[taskObject.id] = cron.createTask(
			taskObject.cronString,
			() => {
				const config = scheduledTaskConfigs[taskObject.id]
				if (config) io.emit("runTask", config)
			}
		)
		if (taskObject.running) scheduledTask[taskObject.id].start()
	},

	startTask: (id, callback=()=>{}) => {
		if (scheduledTask[id]) {
			scheduledTask[id].start()
			scheduledTaskConfigs[id].running = true
		}
		callback(scheduledTaskConfigs)
	},

	stopTask: (id, callback=()=>{}) => {
		if (scheduledTask[id]) {
			scheduledTask[id].stop()
			scheduledTaskConfigs[id].running = false
		}
		callback(scheduledTaskConfigs)
	},

	destroyTask: (id, callback=()=>{}) => {
		if (scheduledTask[id]) scheduledTask[id].destroy()
		delete scheduledTask[id]
		delete scheduledTaskConfigs[id]
		callback(scheduledTaskConfigs)
	},

	listTasks:(callback=()=>{}) => {
		callback(scheduledTaskConfigs)
	}
})