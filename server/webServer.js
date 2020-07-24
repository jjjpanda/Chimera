require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var express    = require('express')
var { exec }   = require('child_process');

var app = express()

const execCallback = (command, options=[]) => (req, res) => {
    exec(command, options, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            res.status(200).send(JSON.stringify(error));
        }
        else{
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            res.status(200).send(JSON.stringify({
                out: stdout,
                err: stderr
            }))
        }
    });
}

const statusCheck = (req, res, next) => {
    exec(`pidof -s motion`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            next()
        }
        else{
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            if(stdout != ""){
                console.log(stdout)
                next()
            }
            else{
                res.status(200).send(JSON.stringify({
                    out: stdout,
                    err: stderr
                }))
            }
        }
    });
}

const tmuxCheck = (req, res, next) => {
    exec(`sudo tmux list-sessions`, (error, stdout, stderr) => {
        if (error) {
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
                    err: stderr
                }))
            }
        }
    });
}

app.get("/on", statusCheck, execCallback(`sudo tmux new-session -d "motion -c /home/oo/shared/motion.conf"`))

app.get('/off', tmuxCheck, execCallback(`sudo tmux kill-server`))

app.get("/end", statusCheck, execCallback(`sudo pkill motion`))

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)
}