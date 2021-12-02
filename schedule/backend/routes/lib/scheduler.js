const cron     = require("node-cron")
const axios  = require("axios").default.create({
	validateStatus: (status) => status == 200,
})
const moment   = require("moment")

const { webhookAlert, randomID, jsonFileHanding, auth } = require("lib")

const {schedulableUrls} = auth

const client = require("memory").client("TASK SCHEDULER")

module.exports = {
	validateStartableTask: (req, res, next) => {
		const { url, body, id, cronString } = req.body
		client.emit("listTask", tasks => {
			if(isValidId(id, tasks, true)){
				client.emit("startTask", id, (scheduledTasks) => {
					res.send({
						running: scheduledTasks[id].running
					})
				})
			}
			else if(isValidId(id, tasks)){
				res.send({
					running: true
				})
			}
			else{
				if(!validateRequestURL(url)){
					res.status(400).send({
						error: "no url"
					})
				}
				else if(body == undefined || !(jsonFileHanding.isStringJSON(body))){
					res.status(400).send({
						error: "no body"
					})
				}
				else if(!cron.validate(cronString)){
					res.status(400).send({
						error: "cron invalid"
					})
				}
				else{
					req.body.body = JSON.parse(body)
					next()
				}
			}
		})
	},

	validateId: (req, res, next) => {
		const { id } = req.body
		client.emit("listTask", (tasks) => {
			if(isValidId(id, tasks)){
				next()
			}
			else{
				res.status(400).send({
					error: "id invalid"
				})
			}
		})
	},

	startNewTask: (req, res) => {
		let { url, body, cronString, id } = req.body
		
		id = `task-${randomID.generate()}`
		let taskObj = {
			id, url, body, cronString, 
			running: true
		}
		client.on(id, generateTask(url, id, body))
		client.emit("createTask", taskObj)
		res.send({
			running: true
		})
	},

	stopTask: (req, res) => {
		const { id } = req.body
		client.emit("stopTask", id, tasks=>{
			res.send({
				stopped: !tasks[id].running
			})
		})
	},

	destroyTask: (req, res) => {
		const { id } = req.body
		client.off(id)
		client.emit("destroyTask", id, tasks=>{
			res.send({
				destroyed: !(id in tasks)
			})
		})
	},

	taskList: (req, res, next) => {
		client.emit("listTask", tasks => {
			req.body.list = Object.entries(tasks).filter(([id, entry]) => {
				return id && entry && id.includes("task")
			}).map(([id, {url, cronString, body, running}]) => {
				return {
					id, url, cronString, body, running
				}
			})
			next()
		})
	},

	sendList: (req, res) => {
		res.send({tasks: req.body.list})
	}
}

const validateRequestURL = (url) => {
	return schedulableUrls.includes(url)
}

const generateTask = (url, id, body) => () => {
	console.log( "CRON: ", url)
	webhookAlert(`scheduled task ID: ${id}\nURL: ${url} started at ${moment().format("LLL")}`, () => {
		axios.post(`${process.env.gateway_HOST}${url}`, body, {
			headers: { "Authorization": process.env.scheduler_AUTH }
		}).then((data) => {
			webhookAlert(`scheduled task ID: ${id}\nURL: ${url} ✅ \nresponse ${JSON.stringify(data, null, 2)}`)
			console.log(data)
		}).catch(({response, message}) => {
			webhookAlert(`scheduled task ID: ${id}\nURL: ${url} ❌ \nerror ${message} | code ${response.status}`)
			console.log(`code ${response.status} | error ${message}`)
		})
	})
}

const isValidId = (id, tasks, stoppedTaskValidationNecessary=false) => {
	if(id != undefined && id.includes("task") && id in tasks){
		if(stoppedTaskValidationNecessary){
			return !tasks[id].running
		}
		else{
			return true
		}
	}
	else{
		return false
	}
}