var fs         = require('fs')
var path       = require('path')
var SSH        = require('simple-ssh');

const sshAuth = {
    host: process.env.storageHost,
    user: process.env.baseUsername,
    ...{ 
        pass: process.env.sshAuthType === "pass" ? process.env.baseAuth : undefined,
        key: process.env.sshAuthType === "key" ? process.env.baseAuth : undefined
    },
    
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
    oneCommand: (command, msg, baseDir, appendable=false) => (req, res, next) => {
        console.log(msg)
        var ssh = new SSH((baseDir != undefined ? 
            {
                ...sshAuth,
                baseDir
            } : 
        sshAuth));

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
                req.body.unformattedResponse = {
                    msg,
                    code,
                    sent: true,
                    output,
                    error,
                }
                next()
            }
        })
        .start();
    },

    startMotion: (req, res, next) => {
        console.log('MOTION ON')
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
                        sent: false
                    }))
                    return false
                }
            }
        })
        .exec(`sudo tmux new-session -d "motion -c ${process.env.filePath}/shared/motion.conf"`, {
            pty: true,
            ...lines(outputChanger, errorChanger),
            exit: (code) => {
                console.log(`EXIT CODE: `, code);
                req.body.unformattedResponse = {
                    msg: 'MOTION ON',
                    code,
                    sent: code == 0,
                    output,
                    error,
                }
                next()
            }
        })
        .start();
    },

    formattedCommandResponse: (req, res) => {
        console.log(req.body.unformattedResponse)
        switch (req.body.unformattedResponse.msg){
            case "MOTION ON":
            case "MOTION OFF":
            case "UPDATING SERVER":
            case "INSTALLING SERVER":
            case "SERVER STOP":
                res.send(JSON.stringify({
                    sent: req.body.unformattedResponse.code == 0
                }))
                break
            case "MOTION STATUS":
            case "SERVER STATUS":
                const running = !(req.body.unformattedResponse.output.length == 0 || (req.body.unformattedResponse.output.includes("?") && req.body.unformattedResponse.output.includes("<defunct>")))
                console.log("OUT: ", req.body.unformattedResponse.output.trim().replace(/\s+/g,' ').split(' '))
                res.send(JSON.stringify({
                    running,
                    duration: (running ? req.body.unformattedResponse.output.trim().replace(/\s+/g,' ').split(' ')[2] : "00:00:00")
                }))
                break
            case "SIZE CHECK":
                console.log("OUT: ", req.body.unformattedResponse.output.trim().replace(/\s+/g,' ').split(' '))
                res.send(JSON.stringify({
                    size: req.body.unformattedResponse.code == 0 ? `${req.body.unformattedResponse.output.trim().replace(/\s+/g,' ').split(' ')[0]}B` : "ERROR"
                }))
                break
            case "FILE COUNT":
                console.log("FILES: ", req.body.unformattedResponse.output.trim())
                res.send(JSON.stringify({
                    count: parseInt(req.body.unformattedResponse.output.trim())
                }))
                break
            case "DELETE PATH":
            case "CLEAN PATH":
                res.send(JSON.stringify({
                    sent: req.body.unformattedResponse.sent
                }))
                break
            default:
                res.send(JSON.stringify(req.body.unformattedResponse))
        }
    },

    validatePath: (req, res, next) => {
        const { path } = req.body
        
        if(path == undefined){
            res.status(400).send({
                error: "No Path"
            })
        }
        else{
            console.log("PATH: ", path)
            next()
        }
    },

    pathCommandAppend: (req, res, next) => {
        const { path } = req.body

        req.body.commandAppends = path;

        next()
    },
    
    afterPath: (command) => (req, res, next) => {
        req.body.commandAppends += command
        next()
    },

    numberSwitch: (placeholder) => (req, res, next) => {
        req.body.commandAppends = req.body.commandAppends.replace(placeholder, parseInt(req.body.days || 100))
        console.log(req.body.commandAppends)
        next()
    }
}