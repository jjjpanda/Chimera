require('dotenv').config()

console.log("--- Starting Servers ---")

if(process.env.storage_ON === "true"){
    require('storage')()
}
if(process.env.livestream_ON === "true"){
    require('livestream')()
}
if(process.env.schedule_ON === "true"){
    require('schedule')()
}
if(process.env.command_ON === "true"){
    require('command')()
}

console.log("--- Starting Gateway ---")

require('./gateway.js')()