const { Server } = require("socket.io")

const { isPrimeInstance, timingSafeCompare } = require("lib")

const DISCONNECT_GRACE_MS = 10000

module.exports = () => {
	if(process.env.memory_ON == "true" && isPrimeInstance){
        
		const io = new Server(process.env.memory_PORT, { 
			cors: {
				origin: false,
				allowedHeaders: ["Authorization"],
				credentials: true
			},
			allowRequest: (req, callback) => {
				const authorized = timingSafeCompare(req.headers.authorization, process.env.memory_AUTH_TOKEN)
				callback(authorized ? "OK" : "UNAUTHORIZED", authorized)
			}
		})

		const {createTask, startTask, stopTask, destroyTask, listTasks} = require("./lib/scheduledTasks.js")(io)
		const {saveProcessEnder, deleteProcessEnder, deleteClientProcesses, cancelProcess} = require("./lib/converterProcesses.js")()
		const {loginReserve, loginRelease} = require("./lib/loginAttempts.js")()
		const sessionSync = require("./lib/sessionSync.js")

		console.log(`🧠 Memory On ▶ PORT ${process.env.memory_PORT}`)

		const pendingCleanup = new Map()
		const activeClients = new Map()

		io.on("connection", client => {
			const owner = client.handshake?.auth?.ownerID || client.id
			clearTimeout(pendingCleanup.get(owner))
			pendingCleanup.delete(owner)
			activeClients.set(owner, client.id)

			const {sessionInvalidate, sessionInvalidateUser, sessionInvalidateAll} = sessionSync(client)

			client.on("log", data => console.log(data))

			client.on("callback", (callback) => {
				callback()
			})

			client.on("createTask", createTask)
			client.on("startTask", startTask)
			client.on("stopTask", stopTask)
			client.on("destroyTask", destroyTask)
			client.on("listTask", listTasks)

			client.on("saveProcessEnder", (id, ender, callback) => saveProcessEnder(owner, id, ender, callback))
			client.on("deleteProcessEnder", deleteProcessEnder)
			client.on("cancelProcess", cancelProcess)

			client.on("loginReserve", loginReserve)
			client.on("loginRelease", loginRelease)

			client.on("sessionInvalidate", sessionInvalidate)
			client.on("sessionInvalidateUser", sessionInvalidateUser)
			client.on("sessionInvalidateAll", sessionInvalidateAll)

			client.on("disconnect", () => {
				const timeout = setTimeout(() => {
					pendingCleanup.delete(owner)
					if (activeClients.get(owner) === client.id) deleteClientProcesses(owner)
				}, DISCONNECT_GRACE_MS)
				timeout.unref()
				pendingCleanup.set(owner, timeout)
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