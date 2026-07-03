require("dotenv").config()

console.log("--- Starting Servers ---")

process.on("uncaughtException", (e) => console.error("uncaught exception:", e))
process.on("unhandledRejection", (e) => console.error("unhandled rejection:", e))

const startService = (name, moduleName, { fatal = false } = {}) => {
	try {
		require(moduleName).start()
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

try {
	require("memory").server()
} catch (e) {
	console.error("❌ memory failed to start:", e.message)
}

console.log("--- Starting Gateway ---")

try {
	require("gateway").start()
} catch (e) {
	console.error("❌ gateway failed to start:", e.message)
}