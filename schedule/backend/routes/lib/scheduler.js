const cron     = require('node-cron');
const validateRequestURL = (url) => {
    switch (url){
        case "/createVideo":
        case "/listFramesVideo":
        case "/createZip":
        case "/statusProcess":
        case "/cancelProcess":
        case "/listProcess":
        case "/deleteProcess":
        case "/motionStart":
        case "/motionStatus":
        case "/motionStop":
        case "/serverUpdate":
        case "/serverStatus":
        case "/serverInstall":
        case "/serverStop":
        case "/pathSize":
        case "/pathFileCount":
        case "/pathDelete":
        case "/pathClean":
        case "/scheduleTask":
        case "/destroyTask":
            return true
        default: 
            return false
    }
}
const request  = require('request');
const moment   = require('moment')

const { webhookAlert, randomID } = require('lib')

module.exports = {
    validateTaskRequest: (req, res, next) => {

        const { url } = req.body

        const isValidURL = validateRequestURL(url);
        
        if(isValidURL){
            next()
        }
        else{
            res.send(JSON.stringify({
                set: false, 
                destroyed: false,
                error: "no url"
            }))
        }

    },

    validateTaskCron: (req, res, next) => {

        const { cronString } = req.body

        const isValidCron = cron.validate(cronString);
        
        if(isValidCron){
            next()
        }
        else{
            res.send(JSON.stringify({
                set: false, 
                destroyed: false,
                error: "cron invalid"
            }))
        }

    },

    scheduleTask: (req, res, next) => {

        const { url, body, cronString } = req.body

        req.app.locals[url] = {}

        req.app.locals[url].cronString = cronString
        req.app.locals[url].task = cron.schedule(cronString, () => {
            console.log( "CRON: ", url )
            webhookAlert(`Daemon Process: ${url} started at ${moment().format("LLL")}`)
            request({
                method: "POST",
                url: `${process.env.command_HOST}${url}`,
                body
            }, (err, response, body) => {
                if(!err && response.statusCode === 200){
                    console.log(body)
                }
                else{
                    console.log(err)
                }
            })
        }, {
            scheduled: true
        })

        req.app.locals[url].task.start()
        req.body.set = true

        next()

    },

    destroyTask: (req, res, next) => {

        const { url } = req.body

        if(req.app.locals[url] != undefined){
            req.app.locals[url].task.destroy()
            req.app.locals[url] = undefined
            req.body.destroyed = true
        }
        else{
            req.body.destroyed = false
        }

        next()

    },

    taskCheck: (req, res) => {

        //check req.app.locals[url]

        const { url } = req.body

        if(req.app.locals[url] != undefined){
            console.log("URL Cron Defined")
            res.send(JSON.stringify({
                set: req.body.set,
                cronString: req.app.locals[url].cronString,
                destroyed: req.body.destroyed
            }))
        }
        else{
            console.log("URL Cron Not Defined")
            res.send(JSON.stringify({
                set: req.body.set,
                destroyed: req.body.destroyed
            }))
        }

    },

    taskList: (req, res, next) => {
        req.body.list = Object.entries(req.app.locals).filter(([id, entry]) => {
            return id && id.includes("task")
        }).map(([id, {url, cronString}]) => {
            return {
                id, url, cronString, body
            }
        })
        next()
    },

    sendList: (req, res) => {
        res.send(req.body.list)
    }
}