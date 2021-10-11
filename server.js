require('dotenv').config()
const {auth} = require('lib')

auth.register(() => {
    console.log("--- Starting Servers ---")
    
    require('storage')()
    require('schedule')()
    require('command')()
    
}, (err) => {
    console.log(err, "Server NOT started... 😭")
})
