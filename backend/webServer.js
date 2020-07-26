require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var proxy      = require('http-proxy-middleware').createProxyMiddleware
var SSH        = require('simple-ssh');

var app = express()

const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const sshAuth = {
    host: process.env.host,
    user: process.env.username,
    pass: process.env.key
}

const output = {
    out: (out) => {
        console.log(`OUT: `,out);
    },
    err: (err) => {
        console.log(`ERR: `,err); // this-does-not-exist: command not found
    },
}

const startMotion = (req, res) => {
    console.log('START MOTION')
    var ssh = new SSH(sshAuth);

    ssh.exec(`pidof -s motion`, {
        ...output,
        exit: (code) => {
            console.log(`EXIT CODE: `, code);
            if(code == 1){
                console.log("next command")
            }
            else {
                res.status(200).send(JSON.stringify({
                    error: code,
                    sent: false
                }))
                return false
            }
        }
    })
    .exec(`sudo tmux new-session -d "motion -c /home/oo/shared/motion.conf"`, {
        pty: true,
        ...output,
        exit: (code) => {
            console.log(`EXIT CODE: `, code);
            if(code == 0){
                res.status(200).send(JSON.stringify({
                    error: code,
                    sent: true
                }))
            }
            else {
                res.status(200).send(JSON.stringify({
                    error: code,
                    sent: false
                }))
            }
        }
    })
    .start();
}

const oneCommand = (command, msg) => (req, res) => {
    console.log(msg)
    var ssh = new SSH(sshAuth);

    ssh.exec(command, {
        pty: true,
        ...output,
        exit: (code) => {
            console.log(`EXIT CODE: `, code);
            res.status(200).send(JSON.stringify({
                error: code,
                sent: true
            }))
        }
    })
    .start();
}

if(process.env.fileServer == "on"){
    console.log("File Server On")
    app.use('/shared', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
}

else if(process.env.fileServer == "proxy"){
    console.log("File Server Proxied")
    app.use("/shared", proxy({
        target: `${process.env.host}:${process.env.PORT}/shared`
    }))
}

if(process.env.converter == "on"){
    console.log("Converter On")
    app.post('/convert', require('./converter.js').convert)
    app.post("/status", require('./converter.js').status )
}

else if(process.env.converter == "proxy"){
    console.log("Converter Proxied")
    app.use("/convert", proxy({
        target: `${process.env.host}:${process.env.PORT}/convert`
    }))
    app.use("/status", proxy({
        target: `${process.env.host}:${process.env.PORT}/status`
    }))
}

if(process.env.webServer == "on"){
    console.log("Motion Controls On")
    app.post("/on", startMotion)
    app.post("/off", oneCommand(`sudo pkill motion`, "MOTION OFF"))
    app.post('/motion', oneCommand(`pidof -s motion`, "MOTION STATUS"))
    app.post('/kill', oneCommand(`sudo tmux kill-server`, "KILL SERVER"))
    app.use('/', express.static(path.resolve(__dirname, "../frontend/"), {
        index: "index.html"
    }))
}

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}