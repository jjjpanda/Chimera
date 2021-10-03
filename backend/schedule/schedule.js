require('dotenv').config()
var express    = require('express')

var app = express()

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

if(process.env.schedule == "on"){
    app.use('/schedule', require('./routes/schedule.js'))
}

module.exports = () => {

    app.listen(process.env.schedulePORT, () => {
        console.log(`⌚ Schedule On ▶ ${process.env.schedulePORT}`)
        console.log(`\t▶ Scheduler Routes:\t /schedule`)
    })

}