require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var NodeSSH    = require('node-ssh')
var express    = require('express')

var ssh = new NodeSSH()

var app = express()
 
// Listen
module.exports = () => {
    ssh.connect({
        host: process.env.host,
        username: process.env.username,
        port: 22,
        password: process.env.key,
        tryKeyboard: true,
        onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
            console.log(name)
            console.log(instructions)
            console.log(instructionsLang)
            console.log(prompts)
            console.log(finish)
        }
    }).then(() => {
        ssh.exec(
            "ls"
        ).then(() => {
            console.log("Command Executed")
        })
        ssh.exec(
            "sudo", 
            [`tmux new-session -d -s motion "motion -c /home/oo/shared/motion.conf"`], 
            {
                execOptions: { pty: true },
                stdin: `${process.env.privateKey}\n`
            }
        ).then(() => {
            console.log("Command Executed")
        })
    }, (err) => {
        console.log(err)
    })
    //app.listen(process.env.PORT)
}