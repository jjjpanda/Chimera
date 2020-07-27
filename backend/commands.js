require('dotenv').config()
var fs         = require('fs')
var SSH        = require('simple-ssh');

const sshAuth = {
    host: process.env.host,
    user: process.env.username,
    pass: process.env.key
}

const lines = (output, error) => {
    return { 
        out: (out) => {
            console.log(`OUT: `,out);
            output += `${out}\n`
        },
        err: (err) => {
            console.log(`ERR: `,err); // this-does-not-exist: command not found
            error += `${err}\n`
        }
    }
}

module.exports = {
    oneCommand: (command, msg) => (req, res) => {
        console.log(msg)
        var ssh = new SSH(sshAuth);

        let output = "", error = ""
    
        ssh.exec(command, {
            pty: true,
            ...lines(output, error),
            exit: (code) => {
                console.log(`EXIT CODE: `, code);
                res.status(200).send(JSON.stringify({
                    code,
                    sent: true,
                    output,
                    error
                }))
            }
        })
        .start();
    },

    startMotion: (req, res) => {
        console.log('START MOTION')
        var ssh = new SSH(sshAuth);

        let output = "", error = ""
    
        ssh.exec(`pidof -s motion`, {
            ...lines(output, error),
            exit: (code) => {
                console.log(`EXIT CODE: `, code);
                if(code == 1){
                    console.log("next command")
                }
                else {
                    res.status(200).send(JSON.stringify({
                        code,
                        sent: false,
                        output,
                        error
                    }))
                    return false
                }
            }
        })
        .exec(`sudo tmux new-session -d "motion -c /home/oo/shared/motion.conf"`, {
            pty: true,
            ...lines(output, error),
            exit: (code) => {
                console.log(`EXIT CODE: `, code);
                res.status(200).send(JSON.stringify({
                    code,
                    sent: code == 0,
                    output,
                    error,
                }))
            }
        })
        .start();
    }
}