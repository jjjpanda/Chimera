require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var express    = require('express')
var { exec }   = require('child_process');

var app = express()

const execCallback = (error, stdout, stderr) => {
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
}

app.get("/on", (req, res) => {
    exec("tmux", [`new-session -d -s motion "motion -c /home/oo/shared/motion.conf"`], execCallback);
})

app.get('/status', (req, res) => {
    exec("pidof motion", execCallback);
})

app.get("/off", (req, res) => {
    exec("pkill", [`-f motion`], execCallback);
})
 

exec("pidof", ["motion"], (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);

    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);

});
// Listen
module.exports = () => {
    
    app.listen(process.env.PORT)
}