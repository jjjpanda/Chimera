require('dotenv').config()
const {
    register
}              = require('./lib/auth.js')

register(() => {
    console.log("--- Starting Servers ---")
    
    require('storage')()
    require('schedule')()
    require('command')()
    
}, (err) => {
    console.log(err, "😭 Server NOT started... 🥺")
})
