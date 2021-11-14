const cron     = require('node-cron');
const request  = require('request');
const moment   = require('moment')

const { webhookAlert, randomID, jsonFileHanding } = require('lib')

module.exports = {
    validateStartableTask: (req, res, next) => {
        const { url, body, id, cronString } = req.body
        if(isValidId(id, req.app.locals, true)){
            next()
        }
        const cookies = req.header('Cookie').split(";")
        const bearerTokenCookie = cookies.find((cookie) => {
            let [key, value] = cookie.split("=")
            return key == "bearertoken" && value.includes('Bearer')
        })
        req.body.cookie = bearerTokenCookie
        if(!validateRequestURL(url)){
            res.send(JSON.stringify({
                error: "no url"
            }))
        }
        else if(body == undefined || !(jsonFileHanding.isStringJSON(body))){
            res.send(JSON.stringify({
                error: "no body"
            }))
        }
        else if(bearerTokenCookie == undefined || bearerTokenCookie.length == 0){
            res.send(JSON.stringify({
                error: "no cookie"
            }))
        }
        else if(!cron.validate(cronString)){
            res.send(JSON.stringify({
                error: "cron invalid"
            }))
        }
        else{
            req.body.body = JSON.parse(body)
            next()
        }
    },

    validateId: (req, res, next) => {
        const { id } = req.body
        if(isValidId(id, req.app.locals)){
            next()
        }
        else{
            res.send(JSON.stringify({
                error: "id invalid"
            }))
        }
    },

    startTask: (req, res) => {
        let { url, body, cookie, cronString, id } = req.body
        
        if(isValidId(id, req.app.locals, true)){
            req.app.locals[id].task.start()
            req.app.locals[id].running = true
        }
        else{
            id = `task-${randomID.generate()}`
            req.app.locals[id] = {id, url, body, cookie, cronString, running: true}
            req.app.locals[id].task = cron.schedule(cronString, generateTask(url, id, body, cookie), {
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
        req.app.locals[id].task.stop()
        req.app.locals[id].running = false
        res.send({
            stopped: !req.app.locals[id].running
        })

    },

    destroyTask: (req, res) => {
        const { id } = req.body
        req.app.locals[id].task.destroy()
        req.app.locals[id] = undefined
        res.send({
            destroyed: id in req.app.locals
        })
    },

    taskList: (req, res, next) => {
        req.body.list = Object.entries(req.app.locals).filter(([id, entry]) => {
            return id && entry && id.includes("task")
        }).map(([id, {url, cronString, body, running}]) => {
            return {
                id, url, cronString, body, running
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

const generateTask = (url, id, body, cookie) => () => {
    console.log( "CRON: ", url)
    webhookAlert(`Task: ${url} started at ${moment().format("LLL")}`, () => {
        request({
            method: "POST",
            url: `${process.env.gateway_HOST}${url}`,
            body,
            headers: {
                "Cookie": cookie
            }
        }, (e, r, b) => {
            if(!e && r.statusCode === 200){
                webhookAlert(`Task: ${id} ${url}\nresponse ${b}`)
                console.log(b)
            }
            else{
                webhookAlert(`Task: ${id} ${url}\nerror ${e} | code ${r.statusCode}`)
                console.log(`code ${r.statusCode} | error ${e}`)
            }
        })
    })
}

const isValidId = (id, locals, stoppedTaskValidationNecessary=false) => {
    if(id != undefined && id.includes('task') && id in locals){
        if(stoppedTaskValidationNecessary){
            if(!locals[id].running){
                return true
            }
            else{
                false
            }
        }
        else{
            return true
        }
    }
    else{
        return false
    }
}