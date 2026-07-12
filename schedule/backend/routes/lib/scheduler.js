const cron     = require("node-cron")
const axios  = require("axios").default.create({
	validateStatus: (status) => status == 200,
})
const { webhookAlert, alertTime, randomID, jsonFileHanding, pruneInterval, schedulableUrls, gatewayHost } = require("lib")
const pool = require("../../lib/pool")

const client = require("memory").client("TASK SCHEDULER")

const ACK_TIMEOUT_MS = 2000
const REHYDRATE_RETRY_MS = 2000
const REHYDRATE_MAX_RETRY_MS = 60000

const ask = (event, ...args) => (callback) =>
	client.timeout(ACK_TIMEOUT_MS).emit(event, ...args, (err, result) => {
		if (err) {
			console.log("MEMORY ACK TIMEOUT", event)
			return callback(null)
		}
		callback(result)
	})

const withTasks = (res, handler) => ask("listTask")((tasks) => {
	if (!tasks) return res.status(503).send({ error: "memory unavailable" })
	handler(tasks)
})

module.exports = {
	ask,

	validateStartableTask: (req, res, next) => {
		const { url, body, id, cronString } = req.body
		withTasks(res, async (tasks) => {
			if(tasks[id] && tasks[id].disabled){
				res.status(400).send({
					error: "task disabled"
				})
			}
			else if(isValidId(id, tasks, true)){
				ask("startTask", id)(async (scheduledTasks) => {
					if (!scheduledTasks) {
						client.emit("stopTask", id)
						return res.status(503).send({ error: "memory unavailable" })
					}
					try {
						await pool.query("UPDATE scheduled_tasks SET running=true WHERE id=$1", [id])
					} catch (err) {
						console.log("TASK UPDATE ERROR", err)
						client.emit("stopTask", id)
						webhookAlert(`⚠️ Failed to mark task ${id} as running in DB after starting its cron — cron stopped again from memory config; the task is not scheduled.`, "admin")
						return res.status(500).send({ error: "Failed to update task in DB" })
					}
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
				req.body.task = tasks[id]
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
		ask("createTask", { id, url, body, cronString, running: true })(async (tasks) => {
			if (tasks?.error) {
				await pool.query("DELETE FROM scheduled_tasks WHERE id=$1", [id])
					.catch(err => console.log("TASK DELETE ERROR", err))
				return res.status(400).send({ error: tasks.error })
			}
			if (!tasks) {
				await pool.query("DELETE FROM scheduled_tasks WHERE id=$1", [id])
					.catch(err => console.log("TASK DELETE ERROR", err))
				client.emit("destroyTask", id)
				webhookAlert(`⚠️ Failed to register task ${id} with memory after inserting it into the DB — the row was rolled back; the task is not scheduled.`, "admin")
				return res.status(503).send({ error: "memory unavailable" })
			}
			res.send({
				running: tasks[id]?.running ?? false
			})
		})
	},

	stopTask: (req, res) => {
		const { id, task } = req.body
		ask("stopTask", id)(async (tasks) => {
			if (!tasks) return res.status(503).send({ error: "memory unavailable" })
			try {
				await pool.query("UPDATE scheduled_tasks SET running=false WHERE id=$1", [id])
			} catch (err) {
				console.log("TASK UPDATE ERROR", err)
				if (task?.running) {
					client.emit("startTask", id)
					webhookAlert(`⚠️ Failed to mark task ${id} as stopped in DB after stopping its cron — cron restarted from memory config; the task is still scheduled.`, "admin")
				}
				return res.status(500).send({ error: "Failed to update task in DB" })
			}
			res.send({
				stopped: !(tasks[id] && tasks[id].running)
			})
		})
	},

	destroyTask: (req, res) => {
		const { id, task } = req.body
		ask("destroyTask", id)(async (tasks) => {
			if (!tasks) return res.status(503).send({ error: "memory unavailable" })
			try {
				await pool.query("DELETE FROM scheduled_tasks WHERE id=$1", [id])
			} catch (err) {
				console.log("TASK DELETE ERROR", err)
				if (task) client.emit("createTask", task)
				webhookAlert(`⚠️ Failed to delete task ${id} from DB after destroying its cron — cron re-registered from memory config; the task is still scheduled.`, "admin")
				return res.status(500).send({ error: "Failed to delete task from DB" })
			}
			res.send({
				destroyed: !(id in tasks)
			})
		})
	},

	taskList: (req, res, next) => {
		withTasks(res, tasks => {
			req.body.list = Object.entries(tasks).filter(([id, entry]) => {
				return id && entry && id.includes("task")
			}).map(([id, {url, cronString, body, running, protected: isProtected, disabled}]) => {
				return {
					id, url, cronString, body, running, protected: isProtected, disabled
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
		if (!maxGb || process.env.storage_ON !== "true") return
		const id = "task-auto-cleanup"
		const register = () => {
			ask("destroyTask", id)(() => {
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
		let retryMs = REHYDRATE_RETRY_MS
		let retryTimer = null
		let inFlight = false
		const alerted = new Set()
		const register = async () => {
			if (inFlight) return
			inFlight = true
			try {
				let rows
				try {
					({ rows } = await pool.query("SELECT * FROM scheduled_tasks"))
				} catch (e) {
					console.log("TASK REHYDRATE ERROR", e)
					clearTimeout(retryTimer)
					retryTimer = setTimeout(() => register(), retryMs)
					if (retryTimer.unref) retryTimer.unref()
					retryMs = Math.min(retryMs * 2, REHYDRATE_MAX_RETRY_MS)
					return
				}
				clearTimeout(retryTimer)
				retryMs = REHYDRATE_RETRY_MS
				const invalid = rows.filter((row) => !isSchedulable(row))
				if (invalid.length) {
					const unalerted = invalid.map(({id}) => id).filter((id) => !alerted.has(id))
					if (unalerted.length) {
						console.log("TASK REHYDRATE: disabling tasks with an invalid cron string or non-schedulable url", unalerted)
						webhookAlert(`⚠️ Disabling ${unalerted.length} scheduled task(s) with an invalid cron string or non-schedulable url on rehydrate — they are kept and listed as disabled but will never run; delete them or recreate them with a valid cron string and a schedulable url: ${unalerted.join(", ")}`, "admin")
						unalerted.forEach((id) => alerted.add(id))
					}
					await pool.query("UPDATE scheduled_tasks SET running=false WHERE id = ANY($1::text[])", [invalid.map(({id}) => id)])
						.catch(err => console.log("TASK UPDATE ERROR", err))
				}
				rows.filter(isSchedulable).forEach(({id, url, body, cron_string, running}) => {
					client.emit("createTask", {id, url, body, cronString: cron_string, running})
				})
				invalid.forEach(({id, url, body, cron_string}) => {
					client.emit("createTask", {id, url, body, cronString: cron_string, running: false, disabled: true})
				})
			} finally {
				inFlight = false
			}
		}
		client.on("connect", register)
		if (client.connected) return register()
	},

	startDbPruning: () => pruneInterval(pool, "DELETE FROM task_runs WHERE ran_at < NOW() - INTERVAL '30 days'")
}

const validateRequestURL = (url) => {
	return schedulableUrls.includes(url)
}

const isSchedulable = ({ cron_string, url }) => cron.validate(cron_string) && validateRequestURL(url)

const runTask = ({ id, url, body } = {}) => {
	if(!url || !schedulableUrls.includes(url)) return
	console.log(id, " | CRON: ", url)
	axios.post(`${gatewayHost()}${url}`, body, {
		headers: { "Authorization": process.env.scheduler_AUTH }
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
