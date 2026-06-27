require("dotenv").config()

console.log("--- Starting Servers ---")

const startService = (name, mod, { fatal = false } = {}) => {
	try {
		mod.start()
	} catch (e) {
		console.error(`❌ ${name} failed to start:`, e.message)
		if (fatal) throw e
	}
}

startService("command", require("command"), { fatal: true })
startService("storage", require("storage"))
startService("livestream", require("livestream"))
startService("schedule", require("schedule"))
startService("object", require("object"))

console.log("--- Starting Socket ---")

require("memory").server()

console.log("--- Starting Gateway ---")

require("gateway").start()