require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var express    = require('express')
var serveIndex = require('serve-index')
var SSH        = require('simple-ssh');
var { exec }   = require('child_process');

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
    console.log(command)
    var stdout, stderr, code
    ssh.exec(command, {
        args: options,
        out: (e) => {
            console.log(e);
            stdout = e
        },
        err: (e) => {
            console.log(e); // this-does-not-exist: command not found
            stderr = e;
        },
        exit: (e) => {
            console.log(e);
            code = e
        }
    }).start().on('end', () => {
        if(code == c){
            next()
        }
        else {
            res.status(200).send(JSON.stringify({
                error: true,
                stdout, 
                stderr,
                code
            }));
        }
    });

}

if(process.env.fileServer){
    app.use('/files', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
}

if(process.env.converter){
    app.post('/convert', require('./converter.js'))
}

app.post("/on", execCallback(`pidof -s motion`, 1), execCallback(`sudo tmux new-session -d "motion -c /home/oo/shared/motion.conf"`), sendRes)

app.post("/off", execCallback(`sudo pkill motion`), sendRes)

app.post('/kill', execCallback(`sudo tmux list-sessions`, 1), execCallback(`sudo tmux kill-server`), sendRes)

app.use('/', express.static(path.resolve(__dirname, "../frontend/"), {
    index: "index.html"
}))

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}