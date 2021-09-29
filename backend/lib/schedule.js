require('dotenv').config()
var express    = require('express')

var app = express()

if(process.env.schedule == "on"){
    app.use('/schedule', require('./subServers/schedule.js'))
}

module.exports = () => {
    
    console.log("Schedule ⌚ On")
    app.listen(process.env.schedulePORT)

}