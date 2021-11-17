require("dotenv").config()

console.log("--- Starting Servers ---")

require("storage")()
require("livestream")()
require("schedule")()
require("command")()

console.log("--- Starting Gateway ---")

require("./gateway.js")()