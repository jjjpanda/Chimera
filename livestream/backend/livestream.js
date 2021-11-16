var path       = require('path')
var express    = require('express')
const { handleServerStart, auth, helmetOptions } = require('lib')
const helmet = require("helmet");

var app = express()

app.use(helmet(helmetOptions))
app.use(require('cookie-parser')())

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/livestream/health', require('heartbeat').heart)

app.use(auth.auth)

app.use('/livestream', require('./routes/livestream.js'))
    
module.exports = () => {
    const successCallback = () => {
        console.log(`👀 Livestream On ▶ PORT ${process.env.livestream_PORT}`)
        console.log(`\t▶ Livestream Routes:\t /livestream`)
    }
    const failureCallback = () => {
        console.log(`👀 Livestream Off ❌`)
    }

    handleServerStart(app, process.env.livestream_PORT, successCallback, failureCallback)
}