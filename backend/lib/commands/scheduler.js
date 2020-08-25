const cron = require('node-cron');
const { validateRequestURL } = require('../tools/validators.js');
const request = require('request');

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

        req.app.locals[url] = cron.schedule(cronString, () => {
            request({
                method: "POST",
                url: `http://localhost:${process.env.PORT}${url}`,
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

        req.app.locals[url].start()
        req.body.set = true

        next()

    },

    destroyTask: (req, res, next) => {

        const { url } = req.body

        if(req.app.locals[url] != undefined){
            req.app.locals[url].destroy()
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
        }
        else{
            console.log("URL Cron Not Defined")
        }

        res.send(JSON.stringify({
            set: req.body.set,
            destroyed: req.body.destroyed
        }))

    }
}