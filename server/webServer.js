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


app.get("/on", execCallback(`sudo tmux new-session -d "motion -c /home/oo/shared/motion.conf"`))

app.get('/status', execCallback(`pidof -s motion`))

app.get('/off', execCallback(`sudo tmux kill-server`))

app.get("/end", execCallback(`sudo pkill motion`))

// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)
}