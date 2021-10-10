var express    = require('express')
const {handleServerStart} = require('lib')

var app = express()

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/task', require('./routes/task.js'))

module.exports = (on) => {
    const onLog = () => {
        console.log(`⌚ Schedule On ▶ PORT ${process.env.schedulePORT}`)
        console.log(`\t▶ Scheduler Routes:\t /schedule`)
    }
    const offLog = () => {
        console.log(`⌚ Schedule Off ❌`)
    }

    if(on){
        handleServerStart(app, process.env.schedulePORT, onLog, offLog)
    }
    else{
        offLog()
    }
}