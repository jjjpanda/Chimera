var express    = require('express')
const {handleServerStart, auth, helmetOptions} = require('lib')
const helmet = require("helmet");

var app = express()

app.use(helmet(helmetOptions))
app.use(require('cookie-parser')())

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/schedule/health', require('heartbeat').heart)

app.use(auth.auth);

app.use('/task', require('./routes/task.js'))

module.exports = () => {
    const successCallback = () => {
        console.log(`⌚ Schedule On ▶ PORT ${process.env.schedule_PORT}`)
        console.log(`\t▶ Scheduler Routes:\t /task`)
    }
    const failureCallback = () => {
        console.log(`⌚ Schedule Off ❌`)
    }

    handleServerStart(app, process.env.schedule_PORT, successCallback, failureCallback)
}