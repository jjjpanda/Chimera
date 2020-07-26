require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var SSH        = require('simple-ssh');

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

var app = express()

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

if(process.env.fileServer){
    app.use('/files', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
}

if(process.env.converter){
    app.post('/convert', require('./converter.js'))
}

app.post("/on", startMotion)

app.post("/off", oneCommand(`sudo pkill motion`, "MOTION OFF"))

app.post('/status', oneCommand(`pidof -s motion`, "MOTION STATUS"))

app.post('/kill', oneCommand(`sudo tmux kill-server`, "KILL SERVER"))

app.use('/', express.static(path.resolve(__dirname, "../frontend/"), {
    index: "index.html"
}))

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}