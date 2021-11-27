console.log("--- Starting Servers ---")

require("command").start()
require("storage").start()
require("livestream").start()
require("schedule").start()

console.log("--- Starting Socket ---")

require("memory").server()

console.log("--- Starting Gateway ---")

require("gateway").start()