var path       = require('path')
var express    = require('express')
const { handleServerStart, auth } = require('lib')
const helmet = require("helmet");

var app = express()

app.use(helmet())
app.use(require('cookie-parser')())

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/storage/health', require('heartbeat').heart)

app.use(auth.auth)

app.use('/motion', require('./routes/motion.js'))

app.use('/convert', require('./routes/convert.js'))
app.use('/file', require('./routes/file.js'))
    
app.use('/shared', express.static(path.join(process.env.storage_FILEPATH, 'shared')))

module.exports = (isOn) => {
    const successCallback = () => {
        console.log(`📂 Storage On ▶ PORT ${process.env.storage_PORT}`)
        console.log(`\t▶ Converter Routes:\t /converter`)
        console.log(`\t▶ Motion Routes:\t /motion`)
        console.log(`\t▶ File Routes:\t /shared`)
    }
    const failureCallback = () => {
        console.log(`📂 Storage Off ❌`)
    }

    handleServerStart(app, process.env.storage_PORT, isOn, successCallback, failureCallback)
}