require('dotenv').config()
var fs         = require('fs')
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

module.exports = {
    oneCommand: (command, msg) => (req, res) => {
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
        .on('ready', () => {
            console.log("ssh connected")
        })
        .start();
    },

    startMotion: (req, res) => {
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
}