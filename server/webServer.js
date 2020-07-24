require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var express    = require('express')
var { exec }   = require('child_process');

var app = express()

app.get("/on", (req, res) => {
    exec("tmux", [`new-session -d -s motion "motion -c /home/oo/shared/motion.conf"`], (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            res.status(200).send(JSON.stringify(error));
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
        res.status(200).send(JSON.stringify({
            out: stdout,
            err: stderr
        }))
    });
})

app.get('/status', (req, res) => {
    exec("pidof motion", (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            res.status(200).send(JSON.stringify(error));
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
        res.status(200).send(JSON.stringify({
            out: stdout,
            err: stderr
        }))
    });
})

app.get("/off", (req, res) => {
    exec("pkill", [`-f motion`], (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            res.status(200).send(JSON.stringify(error));
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
        res.status(200).send(JSON.stringify({
            out: stdout,
            err: stderr
        }))
    });
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