require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var shortid    = require("shortid")
var moment     = require('moment')
var dateFormat = require('./dateFormat.js')

const charList = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ()'
shortid.characters(charList)

const imgDir = `${process.env.filePath}/captures`

module.exports = {   
    randomID: () => {
        return shortid.generate() + "-" + moment().format(dateFormat);
    },
    
    filterList: (camera, start, end, skipEvery=1) => {
        let list = fs.readdirSync(path.resolve(imgDir, camera)).filter( file => file.includes(".jpg") && 
            `${file.split("-")[0]}-${file.split('-')[1]}` > start && 
            `${file.split("-")[0]}-${file.split('-')[1]}` <= end )
        return skipEvery == 1 ? list : list.filter( (file, index) => {
            return (index % skipEvery === 0 )
        })
    },

    filterType: (type) => {
        return fs.readdirSync(path.resolve(imgDir)).filter(file => file.includes(`.${type}`))
    },

    fileName: (camera, start, end, id, type) => {
        return `output_${camera}_${start}_${end}_${id}.${type}`
    },

    parseFileName: (fileName) => {
        const fileInfo = fileName.split('_');
        console.log(fileName)
        return {
            link: `http://${process.env.baseHost}:${process.env.PORT}/shared/captures/${fileName}`,
            type: fileInfo[4].split('.')[1],
            id: fileInfo[4].split('.')[0],
            camera: fileInfo[1],
            start: fileInfo[2],
            end: fileInfo[3]
        }
    },

    findFile: (id) => {
        const fileName = fs.readdirSync(path.resolve(imgDir)).find(file => file.includes(id) && !file.includes('.txt'))
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