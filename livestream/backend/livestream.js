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
    const successCallback = () => {
        console.log(`👀 Livestream On ▶ PORT ${process.env.livestream_PORT}`)
        console.log(`\t▶ Livestream Routes:\t /livestream`)
    }
    const failureCallback = () => {
        console.log(`👀 Livestream Off ❌`)
    }

    handleServerStart(app, process.env.livestream_PORT, isOn, successCallback, failureCallback)
}