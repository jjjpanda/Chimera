require('dotenv').config()

console.log("--- Starting Servers ---")

require('storage')()
require('schedule')()
require('command')()