require("dotenv").config()

console.log("--- Starting Servers ---")

process.on("uncaughtException", (e) => {
	console.error("uncaught exception:", e)
	process.exit(1)
})
process.on("unhandledRejection", (e) => {
	console.error("unhandled rejection:", e)
	process.exit(1)
})

const startService = (name, moduleName, { fatal = false, method = "start" } = {}) => {
	try {
		require(moduleName)[method]()
	} catch (e) {
		console.error(`❌ ${name} failed to start:`, e.message)
		if (fatal) throw e
	}
}

startService("command", "command", { fatal: true })
startService("storage", "storage")
startService("livestream", "livestream")
startService("schedule", "schedule")
startService("object", "object")

console.log("--- Starting Socket ---")

startService("memory", "memory", { fatal: true, method: "server" })

console.log("--- Starting Gateway ---")

startService("gateway", "gateway", { fatal: true })