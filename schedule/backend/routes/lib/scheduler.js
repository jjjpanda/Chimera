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

    startTask: (req, res) => {
        let { url, body, cookies, cronString, id } = req.body
        
        if(id != undefined && id.includes('task') && id in req.app.locals && !req.app.locals[id].running){
            req.app.locals[id].task.start()
        }
        else{
            id = `task-${randomID.generate()}`
            req.app.locals[id] = {id, url, body, cookies, cronString, running: true}
            req.app.locals[id].task = cron.schedule(cronString, generateTask(url, body, cookies), {
                scheduled: true
            })
            req.app.locals[id].task.start()
        }
        res.send({
            running: req.app.locals[id].running
        })
    },

    stopTask: (req, res) => {
        const { id } = req.body
        if(id in req.app.locals){
            req.app.locals[id].task.stop()
            req.app.locals[id].running = false
        }
        res.send({
            stopped: !req.app.locals[id].running
        })

    },

    destroyTask: (req, res) => {
        const { id } = req.body
        if(id in req.app.locals){
            req.app.locals[id].task.destroy()
            req.app.locals[id] = undefined
        }
        res.send({
            destroyed: id in req.app.locals
        })
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

const generateTask = (url, body, cookies) => () => {
    console.log( "CRON: ", url )
    webhookAlert(`Task: ${url} started at ${moment().format("LLL")}`)
    request({
        method: "POST",
        url: `${process.env.command_HOST}${url}`,
        body,
        headers: {
            "Cookies": cookies
        }
    }, (e, r, b) => {
        if(!e && r.statusCode === 200){
            webhookAlert(`Task: ${url} response ${b}`)
            console.log(b)
        }
        else{
            webhookAlert(`Task: ${url} error ${e}`)
            console.log(e)
        }
    })
}