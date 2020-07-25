require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var SSH        = require('simple-ssh');
var { exec }   = require('child_process');
const { kill } = require('process')

var ssh = new SSH({
    host: process.env.host,
    user: process.env.username,
    pass: process.env.key
});

var app = express()

const sendRes = (req, res) => {
    res.status(200).send(JSON.stringify({
        sent: true
    }))
}

const execCallback = (command, c=0, options=[]) => (req, res, next) => {
    ssh.exec(command, {
        args: options,
        pty: true,
        out: (out) => {
            console.log(`${command} OUT: `,out);
        },
        err: (err) => {
            console.log(`${command} ERR: `,err); // this-does-not-exist: command not found
        },
        exit: (code) => {
            console.log(`${command} EXIT CODE: `, code);
            if(c == code){
                next()
            }
            else {
                res.status(200).send(JSON.stringify({
                    error: true,
                    code
                }));
            }
        }
    }).start();
}

const startMotion = (req, res) => {
    ssh.exec(`pidof -s motion`, {
        out: (out) => {
            console.log(`OUT: `,out);
        },
        err: (err) => {
            console.log(`ERR: `,err); // this-does-not-exist: command not found
        },
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
        out: (out) => {
            console.log(`OUT: `,out);
        },
        err: (err) => {
            console.log(`ERR: `,err); // this-does-not-exist: command not found
        },
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

const oneCommand = (req, res) => {
    return {
        out: (out) => {
            console.log(`OUT: `,out);
        },
        err: (err) => {
            console.log(`ERR: `,err); // this-does-not-exist: command not found
        },
        exit: (code) => {
            console.log(`EXIT CODE: `, code);
            res.status(200).send(JSON.stringify({
                error: code,
                sent: true
            }))
        }
    }
}

const stopMotion = (req, res) => {
    ssh.exec(`sudo pkill motion`, oneCommand(req, res))
    .start();
}

const killServer = (req, res) => {
    ssh.exec(`sudo tmux kill-server`, oneCommand(req, res))
    .start();
}

if(process.env.fileServer){
    app.use('/files', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
}

if(process.env.converter){
    app.post('/convert', require('./converter.js'))
}

app.post("/on", startMotion)

app.post("/off", stopMotion)

app.post('/kill', killServer)

app.use('/', express.static(path.resolve(__dirname, "../frontend/"), {
    index: "index.html"
}))

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}