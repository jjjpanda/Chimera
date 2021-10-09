require('dotenv').config()
var express    = require('express')

var app = express()

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/task', require('./routes/task.js'))

module.exports = () => {

    app.listen(process.env.schedulePORT, () => {
        console.log(`⌚ Schedule On ▶ PORT ${process.env.schedulePORT}`)
        console.log(`\t▶ Scheduler Routes:\t /schedule`)
    })

}