const cron     = require("node-cron")
const axios  = require("axios").default.create({
	validateStatus: (status) => status == 200,
})
const { webhookAlert, alertTime, randomID, jsonFileHanding, pruneInterval, schedulableUrls, storageHost, readSecret } = require("lib")
const pool = require("../../lib/pool")

const client = require("memory").client("TASK SCHEDULER")

const withTasks = (res, handler) => client.timeout(2000).emit("listTask", (err, tasks) => {
	if (err) return res.status(503).send({ error: "memory unavailable" })
	handler(tasks)
})

module.exports = {
	validateStartableTask: (req, res, next) => {
		const { url, body, id, cronString } = req.body
		withTasks(res, async tasks => {
			if(isValidId(id, tasks, true)){
				try {
					await pool.query("UPDATE scheduled_tasks SET running=true WHERE id=$1", [id])
				} catch (err) {
					console.log("TASK UPDATE ERROR", err)
					return res.status(500).send({ error: "Failed to update task in DB" })
				}
				client.timeout(2000).emit("startTask", id, (err, scheduledTasks) => {
					if (err) return res.status(503).send({ error: "memory unavailable" })
					res.send({
						running: scheduledTasks[id]?.running ?? false
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
		withTasks(res, (tasks) => {
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

	startNewTask: async (req, res) => {
		let { url, body, cronString, id } = req.body

		id = `task-${randomID.generate()}`
		try {
			await pool.query(
				"INSERT INTO scheduled_tasks (id, url, body, cron_string, running) VALUES ($1, $2, $3, $4, true)",
				[id, url, body, cronString]
			)
		} catch (err) {
			console.log("TASK INSERT ERROR", err)
			return res.status(500).send({ error: "Failed to insert task into DB" })
		}
		client.emit("createTask", {
			id, url, body, cronString,
			running: true
		})
		res.send({
			running: true
		})
	},

	stopTask: async (req, res) => {
		const { id } = req.body
		try {
			await pool.query("UPDATE scheduled_tasks SET running=false WHERE id=$1", [id])
		} catch (err) {
			console.log("TASK UPDATE ERROR", err)
			return res.status(500).send({ error: "Failed to update task in DB" })
		}
		client.timeout(2000).emit("stopTask", id, (err, tasks) => {
			if (err) return res.status(503).send({ error: "memory unavailable" })
			res.send({
				stopped: !(tasks[id] && tasks[id].running)
			})
		})
	},

	destroyTask: async (req, res) => {
		const { id } = req.body
		try {
			await pool.query("DELETE FROM scheduled_tasks WHERE id=$1", [id])
		} catch (err) {
			console.log("TASK DELETE ERROR", err)
			return res.status(500).send({ error: "Failed to delete task from DB" })
		}
		client.timeout(2000).emit("destroyTask", id, (err, tasks) => {
			if (err) return res.status(503).send({ error: "memory unavailable" })
			res.send({
				destroyed: !(id in tasks)
			})
		})
	},

	taskList: (req, res, next) => {
		withTasks(res, tasks => {
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
				? "SELECT * FROM task_runs WHERE task_id=$1 ORDER BY ran_at DESC LIMIT 200"
				: "SELECT * FROM task_runs ORDER BY ran_at DESC LIMIT 200"
			const { rows } = await pool.query(query, taskId ? [taskId] : [])
			res.send({ runs: rows })
		} catch (e) {
			console.log("TASK RUNS ERROR", e)
			res.status(500).send({ error: true })
		}
	},

	registerTaskRunner: () => {
		client.off("runTask")
		client.on("runTask", runTask)
	},

	autoRegisterCleanup: () => {
		const maxGb = parseFloat(process.env.storage_MAX_GB) || 0
		if (!maxGb) return
		const id = "task-auto-cleanup"
		const register = () => {
			client.emit("destroyTask", id, () => {
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
	},

	rehydrateTasks: () => {
		const register = async () => {
			let rows
			try {
				({ rows } = await pool.query("SELECT * FROM scheduled_tasks"))
			} catch (e) {
				console.log("TASK REHYDRATE ERROR", e)
				return
			}
			rows.forEach(({id, url, body, cron_string, running}) => {
				client.emit("createTask", {id, url, body, cronString: cron_string, running})
			})
			client.emit("listTask", async (tasks) => {
				let current
				try {
					({ rows: current } = await pool.query("SELECT * FROM scheduled_tasks"))
				} catch (e) {
					console.log("TASK RECONCILE ERROR", e)
					return
				}
				Object.entries(tasks)
					.filter(([id, task]) => id.includes("task") && !task.protected && !current.some(row => row.id === id))
					.forEach(([id]) => {
						console.log("TASK RECONCILE, DESTROYING ORPHAN", id)
						client.emit("destroyTask", id, () => {})
					})
			})
		}
		client.on("connect", register)
		if (client.connected) return register()
	},

	startDbPruning: () => pruneInterval(pool, "DELETE FROM task_runs WHERE ran_at < NOW() - INTERVAL '30 days'")
}

const validateRequestURL = (url) => {
	return schedulableUrls.includes(url)
}

const runTask = ({ id, url, body }) => {
	if(!validateRequestURL(url)){
		webhookAlert(`scheduled task ID: ${id}\ndatetime: ${alertTime().format("LLL z")}\nURL: ${url} ❌ \nerror url is not schedulable`)
		return
	}
	console.log(id, " | CRON: ", url)
	axios.post(`${storageHost()}${url}`, body, {
		headers: { "Authorization": readSecret("scheduler_AUTH") }
	}).then(({data}) => {
		webhookAlert(`scheduled task ID: ${id}\ndatetime: ${alertTime().format("LLL z")}\nURL: ${url} ✅ \nresponse ${JSON.stringify(data, null, 2)}`)
		console.log(data)
		pool.query(
			"INSERT INTO task_runs (task_id, url, status, http_status) VALUES ($1, $2, 'success', 200)",
			[id, url]
		).catch(err => console.log("RUN INSERT ERROR", err))
	}).catch(({response, message}) => {
		webhookAlert(`scheduled task ID: ${id}\ndatetime: ${alertTime().format("LLL z")}\nURL: ${url} ❌ \nerror ${message} | code ${response?.status}`)
		console.log(`code ${response?.status} | error ${message}`)
		pool.query(
			"INSERT INTO task_runs (task_id, url, status, http_status, error) VALUES ($1, $2, 'failure', $3, $4)",
			[id, url, response?.status ?? null, message]
		).catch(err => console.log("RUN INSERT ERROR", err))
	})
}

const isValidId = (id, tasks, stoppedTaskValidationNecessary=false) => {
	if(typeof id == "string" && id.includes("task") && id in tasks){
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
