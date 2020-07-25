require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var express    = require('express')
var { exec }   = require('child_process');

var app = express()

const execCallback = (command, options=[]) => (req, res) => {
    console.log(command)
    exec(command, options, (error, stdout, stderr) => {
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
    });
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
    });
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

app.get("/on", statusCheck, execCallback(`sudo tmux new-session -d "motion -c /home/oo/shared/motion.conf"`))

app.get("/off", execCallback(`sudo pkill motion`))

app.get('/kill', tmuxCheck, execCallback(`sudo tmux kill-server`))

app.use('/', express.static(path.resolve(__dirname, "../frontend/"), {
    index: "index.html"
}))

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)

}