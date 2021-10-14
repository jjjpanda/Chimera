var path       = require('path')
var express    = require('express')
const { handleServerStart, auth } = require('lib')

var app = express()

app.use(require('cookie-parser')())

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(auth.auth)

app.use('/livestream', require('./routes/livestream.js'))
    
module.exports = (isOn) => {
    const onLog = () => {
        console.log(`👀 Livestream On ▶ PORT ${process.env.livestream_PORT}`)
        console.log(`\t▶ Livestream Routes:\t /livestream`)
    }
    const offLog = () => {
        console.log(`👀 Livestream Off ❌`)
    }

    handleServerStart(app, process.env.livestream_PORT, isOn, onLog, offLog)
}