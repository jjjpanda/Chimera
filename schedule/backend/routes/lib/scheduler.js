const cron     = require("node-cron")
const axios  = require("axios").default.create({
	validateStatus: (status) => status == 200,
})
const { webhookAlert, alertTime, randomID, jsonFileHanding, auth } = require("lib")
const pool = require("../../lib/pool")

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
			if(isValidId(id, tasks) && !(tasks[id] && tasks[id].protected)){
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
				stopped: !(tasks[id] && tasks[id].running)
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
			}).map(([id, {url, cronString, body, running, protected: isProtected}]) => {
				return {
					id, url, cronString, body, running, protected: isProtected
				}
			})
			next()
		})
	},

	sendList: (req, res) => {
		res.send({tasks: req.body.list})
	},

	taskRuns: async (req, res) => {
		try {
			const { taskId } = req.params
			const query = taskId
				? `SELECT * FROM task_runs WHERE task_id=$1 ORDER BY ran_at DESC LIMIT 200`
				: `SELECT * FROM task_runs ORDER BY ran_at DESC LIMIT 200`
			const { rows } = await pool.query(query, taskId ? [taskId] : [])
			res.send({ runs: rows })
		} catch (e) {
			res.status(500).send({ error: true })
		}
	},

	autoRegisterCleanup: () => {
		const maxGb = parseFloat(process.env.storage_MAX_GB) || 0
		if (!maxGb) return
		const id = "task-auto-cleanup"
		const register = () => {
			client.emit("destroyTask", id, () => {
				client.off(id)
				client.on(id, generateTask("/file/pathAutoClean", id, {}))
				client.emit("createTask", {
					id,
					url: "/file/pathAutoClean",
					body: {},
					cronString: "0 * * * *",
					running: true,
					protected: true
				})
			})
		}
		client.on("connect", register)
		if (client.connected) register()
	}
}

const validateRequestURL = (url) => {
	return schedulableUrls.includes(url)
}

const generateTask = (url, id, body) => () => {
	console.log(id, " | CRON: ", url)
	axios.post(`${process.env.gateway_HOST}${url}`, body, {
		headers: { "Authorization": process.env.scheduler_AUTH }
	}).then(({data}) => {
		webhookAlert(`scheduled task ID: ${id}\ndatetime: ${alertTime().format("LLL z")}\nURL: ${url} ✅ \nresponse ${JSON.stringify(data, null, 2)}`)
		console.log(data)
		pool.query(
			`INSERT INTO task_runs (task_id, url, status, http_status) VALUES ($1, $2, 'success', 200)`,
			[id, url]
		).catch(err => console.log("RUN INSERT ERROR", err))
	}).catch(({response, message}) => {
		webhookAlert(`scheduled task ID: ${id}\ndatetime: ${alertTime().format("LLL z")}\nURL: ${url} ❌ \nerror ${message} | code ${response?.status}`)
		console.log(`code ${response?.status} | error ${message}`)
		pool.query(
			`INSERT INTO task_runs (task_id, url, status, http_status, error) VALUES ($1, $2, 'failure', $3, $4)`,
			[id, url, response?.status ?? null, message]
		).catch(err => console.log("RUN INSERT ERROR", err))
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