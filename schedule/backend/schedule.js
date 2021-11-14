var express    = require('express')
const {handleServerStart, auth} = require('lib')
const helmet = require("helmet");

var app = express()

app.use(helmet())
app.use(require('cookie-parser')())

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/schedule/health', require('heartbeat').heart)

app.use(auth.auth);

app.use('/task', require('./routes/task.js'))

module.exports = (isOn) => {
    const successCallback = () => {
        console.log(`⌚ Schedule On ▶ PORT ${process.env.schedule_PORT}`)
        console.log(`\t▶ Scheduler Routes:\t /task`)
    }
    const failureCallback = () => {
        console.log(`⌚ Schedule Off ❌`)
    }

    handleServerStart(app, process.env.schedule_PORT, isOn, successCallback, failureCallback)
}