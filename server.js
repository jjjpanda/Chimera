require('dotenv').config()

console.log("--- Starting Servers ---")

require('storage')()
require('livestream')()
require('schedule')()
require('command')()