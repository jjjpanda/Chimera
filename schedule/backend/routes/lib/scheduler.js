const cron     = require('node-cron');
const request  = require('request');
const moment   = require('moment')

const { webhookAlert, randomID } = require('lib')

module.exports = {
    validateTaskRequest: (req, res, next) => {
        const { url, body, cookies } = req.body
        const isValidURL = validateRequestURL(url);
        if(!isValidURL){
            res.send(JSON.stringify({
                error: "no url"
            }))
        }
        else if(body != undefined && body instanceof Object){
            res.send(JSON.stringify({
                error: "no body"
            }))
        }
        else if(cookies != undefined && cookies.length > 0){
            res.send(JSON.stringify({
                error: "no cookies"
            }))
        }
        else{
            next()
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
                error: "cron invalid"
            }))
        }
    },

    validateId: (req, res, next) => {
        const { id } = req.body
        
        if(id != undefined && id.includes('task')){
            next()
        }
        else{
            res.send(JSON.stringify({
                error: "id invalid"
            }))
        }
    },

    scheduleTask: (req, res) => {
        const { url, body, cookies, cronString } = req.body
        const id = `task-${randomID.generate()}`
        req.app.locals[id] = {id, url, body, cookies, cronString, running: true}
        req.app.locals[id].task = cron.schedule(cronString, () => {
            console.log( "CRON: ", url )
            webhookAlert(`Daemon Process: ${url} started at ${moment().format("LLL")}`)
            request({
                method: "POST",
                url: `${process.env.gateway_HOST}${url}`,
                body,
                headers: {
                    "Cookies": cookies
                }
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
        req.app.locals[id].task.start()
        res.send({
            set: true
        })
    },

    stopTask: (req, res) => {

        const { id } = req.body
        let stopped = false

        if(id in req.app.locals){
            req.app.locals[id].task.stop()
            req.app.locals[id].running = false
            req.body.stopped = true
        }

        res.send({
            stopped
        })

    },

    destroyTask: (req, res) => {

        const { id } = req.body
        let destroyed = false

        if(id in req.app.locals){
            req.app.locals[id].task.destroy()
            req.app.locals[id] = undefined
            req.body.destroyed = true
        }

        res.send({
            destroyed
        })

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

const validateRequestURL = (url) => {
    const validateUrls = ["/convert/listProcess"]
    return validateUrls.includes(url)
}