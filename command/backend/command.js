var path       = require('path')
var express    = require('express')
const { handleServerStart, auth } = require('lib')
const mkdirp = require('mkdirp')

var app = express()

app.use(require('cookie-parser')())

app.use(require('./routes/gateway.js'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/command/health', require('heartbeat').heart)

app.use('/.well-known/acme-challenge/', express.static(path.join(__dirname, '../../.well-known/acme-challenge'), {
    dotfiles: "allow"
}))

app.use('/authorization', require('./routes/authorization.js'))
app.use('/res', express.static(path.join(__dirname, '../frontend/res')));
app.use('/', express.static(path.join(__dirname, "../dist/"), {
    index: "app.html"
}))

module.exports = (isOn) => {
    const successCallback = () => {
        console.log(`🎮 Command On ▶ PORT ${process.env.command_PORT}`)
        console.log(`\t▶ Authorization Routes:\t /authorization`)
        console.log(`\t▶ Resource Routes:\t /res`)
        console.log(`\t▶ Web App Launched`)
    }
    const failureCallback = () => {
        console.log(`🎮 Command Off ❌`)
    }

    const failCall = (err) => {
        console.log(err)
        failureCallback()
    }

    const successCallbackSecure = () => {
        console.log(`🎮🔒 Secure Command On ▶ PORT ${process.env.command_PORT_SECURE}`)
    }
    const failureCallbackSecure = () => {
        console.log(`🎮🔒 Secure Command Off ❌`)
    }

    auth.register(() => {
        mkdirp(path.join(__dirname, '../../.well-known/acme-challenge')).then((made) => {
            handleServerStart(app, process.env.command_PORT, isOn, successCallback, failureCallback)
            handleSecureServerStart(app, process.env.command_PORT_SECURE, successCallbackSecure, failureCallbackSecure)
        }, failCall)
    }, failCall)
}