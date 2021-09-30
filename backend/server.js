require('dotenv').config()
const {
    register
}              = require('./lib/execTools/auth.js')

register(() => {
    console.log("Starting Servers")
    if(process.env.storage == "on"){
        require('./lib/storage.js')()
    }
    
    if(process.env.schedule == "on"){
        require('./lib/schedule.js')()
    }
    
    //require('./lib/motion.js')()
    
    if(process.env.command == "on"){
        require('./lib/command.js')()
    }
}, (err) => {
    console.log(err, "😭 Server NOT started... 🥺")
})
