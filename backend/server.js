require('dotenv').config()
const {
    register
}              = require('./lib/auth.js')

register(() => {
    console.log("Starting Servers")
    if(process.env.storage == "on"){
        require('./storage/storage.js')()
    }
    
    if(process.env.schedule == "on"){
        require('./schedule/schedule.js')()
    }
    
    if(process.env.command == "on"){
        require('./command/command.js')()
    }
}, (err) => {
    console.log(err, "😭 Server NOT started... 🥺")
})
