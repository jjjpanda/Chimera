const { Server } = require("socket.io")

const { isPrimeInstance } = require("lib")

module.exports = () => {
	if(process.env.memory_ON == "true" && isPrimeInstance){
        
		const io = new Server(process.env.memory_PORT, { 
			cors: {
				origin: false,
				allowedHeaders: ["Authorization"],
				credentials: true
			},
			allowRequest: (req, callback) => {
				const authorized = req.headers.authorization == process.env.memory_AUTH_TOKEN
				callback(authorized ? "OK" : "UNAUTHORIZED", authorized)
			}
		})

		const {createTask, startTask, stopTask, destroyTask, listTasks} = require("./lib/scheduledTasks.js")(io)
		const {saveProcessEnder, cancelProcess} = require("./lib/converterProcesses.js")(io)
		const {loginCheck, loginFailure} = require("./lib/loginAttempts.js")()
		const cronTask = require("./lib/cronTask.js")(io)

		console.log(`🧠 Memory On ▶ PORT ${process.env.memory_PORT}`)
        
		io.on("connection", client => {
			client.on("log", data => console.log(data))

			client.on("callback", (callback) => {
				callback()
			})

			client.on("cron", cronTask)

			client.on("createTask", createTask)
			client.on("startTask", startTask)
			client.on("stopTask", stopTask)
			client.on("destroyTask", destroyTask)
			client.on("listTask", listTasks)

			client.on("saveProcessEnder", saveProcessEnder)
			client.on("cancelProcess", cancelProcess)

			client.on("loginCheck", loginCheck)
			client.on("loginFailure", loginFailure)

			client.on("disconnect", () => {
				console.log(`▶ 🧠 CLIENT WITH ID: ${client.id} DISCONNECTED`)
			})
		})

		process.on("SIGINT", () => {
			io.close(()=> {
				console.log("🧠 Memory Off ❌")
			})
		})
	}
}