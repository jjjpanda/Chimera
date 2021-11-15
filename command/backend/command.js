var path       = require('path')
var express    = require('express')
const { handleServerStart, auth, helmetOptions } = require('lib')
const helmet = require("helmet");

var app = express()

app.use(helmet(helmetOptions))
app.use(require('cookie-parser')())

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/command/health', require('heartbeat').heart)

app.use('/authorization', require('./routes/authorization.js'))
app.use('/res', express.static(path.join(__dirname, '../frontend/res')));
for(const webpath of ["/", "/login", "/login/:password"]){
    app.use(webpath, express.static(path.join(__dirname, "../dist/"), {
        index: "app.html"
    }))
}

module.exports = (isOn) => {
    const successCallback = () => {
        console.log(`🎮 Command On ▶ PORT ${process.env.command_PORT}`)
        console.log(`\t▶ Authorization Routes:\t /authorization`)
        console.log(`\t▶ Resource Routes:\t /res`)
        console.log(`\t▶ Web App Launched`)
    }
    const failureCallback = (err) => {
        if(err != undefined){
            console.log(err)
        }
        console.log(`🎮 Command Off ❌`)
    } 

    auth.register(() => {
        handleServerStart(app, process.env.command_PORT, isOn, successCallback, failureCallback)
    }, failureCallback)
}