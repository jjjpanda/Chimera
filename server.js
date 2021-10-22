require('dotenv').config()

console.log("--- Starting Servers ---")

require('storage')()
require('livestream')()
require('schedule')()
require('command')()

/* const {webhookAlert} = require('lib')
if(process.env.NODE_ENV === "production"){
    webhookAlert("heartbeat", (err) => {
        resolve()
    })
} */