require("dotenv").config()

console.log("--- Starting Servers ---")

const startService = (name, mod) => {
	try { mod.start() } catch (e) { console.error(`❌ ${name} failed to start:`, e.message) }
}

startService("command", require("command"))
startService("storage", require("storage"))
startService("livestream", require("livestream"))
startService("schedule", require("schedule"))
startService("object", require("object"))

console.log("--- Starting Socket ---")

require("memory").server()

console.log("--- Starting Gateway ---")

require("gateway").start()