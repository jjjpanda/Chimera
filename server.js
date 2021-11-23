require("dotenv").config()

console.log("--- Starting Servers ---")

require("storage").start()
require("livestream").start()
require("schedule").start()
require("command").start()

console.log("--- Starting Socket ---")

require("memory").server()

console.log("--- Starting Gateway ---")

require("gateway").start()