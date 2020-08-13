require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var shortid    = require("shortid")
const request  = require('request');
var moment     = require('moment')
var dateFormat = require('./dateFormat.js')

const charList = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ()'
shortid.characters(charList)

module.exports = {
    sendAlert: (content) => {
        request({
            method: "POST",
            url: process.env.alertURL,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content
            }),
        }, (error, response, body) => {
            if (!error) {
                console.log('Alert Sent')
            } else {
                console.log("Error sending alert: ", error)
            }
        });
    },
    
    randomID: () => {
        return shortid.generate() + "-" + moment().format(dateFormat);
    },
    
    filterList: (camera, start, end) => {
        return fs.readdirSync(path.resolve(process.env.imgDir, camera)).filter( file => file.includes(".jpg") && 
                `${file.split("-")[0]}-${file.split('-')[1]}` > start && 
                `${file.split("-")[0]}-${file.split('-')[1]}` <= end )
    },

    filterType: (type) => {
        return fs.readdirSync(path.resolve(process.env.imgDir)).filter(file => file.includes(`.${type}`))
    },

    fileName: (camera, start, end, id, type) => {
        return `output_${camera}_${start}_${end}_${id}.${type}`
    },

    parseFileName: (fileName) => {
        const fileInfo = fileName.split('_');
        console.log(fileName)
        return {
            link: `/shared/captures/${fileName}`,
            type: fileInfo[4].split('.')[1],
            id: fileInfo[4].split('.')[0],
            camera: fileInfo[1],
            start: fileInfo[2],
            end: fileInfo[3]
        }
    },

    findFile: (id) => {
        const fileName = fs.readdirSync(path.resolve(process.env.imgDir)).find(file => file.includes(id) && !file.includes('.txt'))
        return fileName == undefined ? "output_0_start_end_id.type" : fileName
    },

    validateRequest: (req, res, next) => {
        let { camera, start, end } = req.body;

        start = (start == undefined ? moment().subtract(1, "week") : moment(start, dateFormat)).format(dateFormat)

        end = (end == undefined ? moment() : moment(end, dateFormat)).format(dateFormat)
        
        if(camera == undefined){
            res.status(400).send({
                error: "No Camera"
            })
        }
        else{
            camera = camera.toString()
            next()
        }
    },

    validateID: (req, res, next) => {
        const { id } = req.body
        
        if(id == undefined){
            res.status(400).send({
                error: "No ID"
            })
        }
        else{
            next()
        }
    },
}