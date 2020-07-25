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

const execCallback = (command, options=[]) => (req, res) => {
    console.log(command)
    /* exec(command, options, (error, stdout, stderr) => {
        if (error) {
            console.log("Command failed")
            console.error(`exec error: ${error}`);
            res.status(200).send(JSON.stringify(error));
        }
        else{
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            res.status(200).send(JSON.stringify({
                out: stdout,
                err: stderr,
                command: "sent"
            }))
        }
    }); */
    ssh.exec(command, {
        args: options,
        out: function(stdout) {
            console.log(stdout);
            res.status(200).send(JSON.stringify({
                out: stdout,
                command: "sent"
            }))
        },
        err: function(stderr) {
            console.log(stderr); // this-does-not-exist: command not found
            res.status(200).send(JSON.stringify(error));
        },
        exit: function(code) {
            console.log(code);
        }
    }).start();
}

const statusCheck = (req, res, next) => {
    exec(`pidof -s motion`, (error, stdout, stderr) => {
        if (error) {
            console.log("Process not running")
            console.error(`exec error: ${error}`);
            next()
        }
        else{
            res.status(200).send(JSON.stringify({
                out: stdout,
                err: stderr,
                process: "running"
            }))

        }
    })
}

const tmuxCheck = (req, res, next) => {
    exec(`sudo tmux list-sessions`, (error, stdout, stderr) => {
        if (error) {
            console.log('TMUX not running')
            console.error(`exec error: ${error}`);
            res.status(200).send(JSON.stringify(error));
        }
        else{
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            if(!stdout.includes("no server running")){
                console.log(stdout)
                next()
            }
            else{
                res.status(200).send(JSON.stringify({
                    out: stdout,
                    err: stderr,
                    server: "running"
                }))
            }
        }
    });
}

if(process.env.fileServer){
    app.use('/files', express.static(path.join(process.env.filePath)), serveIndex(path.join(process.env.filePath), {'icons': true}))
}

if(process.env.converter){
    app.post('/convert', require('./converter.js'))
}

app.post("/on", statusCheck, execCallback(`sudo tmux new-session -d "motion -c /home/oo/shared/motion.conf"`))

app.post("/off", execCallback(`sudo pkill motion`))

app.post('/kill', tmuxCheck, execCallback(`sudo tmux kill-server`))

app.use('/', express.static(path.resolve(__dirname, "../frontend/"), {
    index: "index.html"
}))

ssh.exec(`pidof -s motion`, {
    pty: true,
    out: function(stdout) {
        console.log("OUT ", stdout);
    },
    err: function(stderr) {
        console.log("ERR ", stderr); // this-does-not-exist: command not found
    },
    exit: function(code) {
        console.log("EXIT ", code); // 69
    }
}).start();

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}