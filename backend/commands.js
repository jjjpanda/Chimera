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
            output(`${out}\n`)
        },
        err: (err) => {
            console.log(`ERR: `,err); // this-does-not-exist: command not found
            error(`${err}\n`)
        }
    }
}

module.exports = {
    oneCommand: (command, msg, appendable=false) => (req, res) => {
        console.log(msg)
        var ssh = new SSH(sshAuth);

        let output = "", error = ""
        let outputChanger = (res) => {
            output += res
        }
        let errorChanger = (res) => {
            error += res
        }

        let commandAppends = ""
        if(appendable && req.body && req.body.commandAppends){
            commandAppends = req.body.commandAppends
        }
    
        ssh.exec(command + commandAppends, {
            pty: true,
            ...lines(outputChanger, errorChanger),
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
        let outputChanger = (res) => {
            output += res
        }
        let errorChanger = (res) => {
            error += res
        }
    
        ssh.exec(`ps -e | grep motion`, {
            ...lines(outputChanger, errorChanger),
            exit: (code) => {
                console.log(`EXIT CODE: `, code);
                //console.log(output)
                if(output.includes("defunct") || code == 1){
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
        .exec(`sudo tmux new-session -d "motion -c ${process.env.sharedLocation}/shared/motion.conf"`, {
            pty: true,
            ...lines(outputChanger, errorChanger),
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