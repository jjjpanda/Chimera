var express    = require('express')
const path = require('path')
const fs = require('fs')
var {validateBody} = require('lib')
const rimraf = require('rimraf')
const moment = require('moment')

const app = express.Router();

const validateCameraAndAppendToPath = (req, res, next) => {
    const {camera} = req.body
    if(camera){
        req.body.appendedPath = path.resolve(process.env.storage_FILEPATH, "./shared/captures/", camera)
        next()
    }
    else{
        res.send({error: "No camera number provided"})
    }
}

const validateDays = (req, res, next) => {
    const {days} = req.body
    if(days != null){
        next()
    }
    else{
        res.send({error: "number of days not provided"})
    }
}

const directoryList = (req, res, next) => {
    fs.readdir(req.body.appendedPath, (err, files) => {
        if(!err) {
            req.body.directoryList = files
            next()
        }
        else{
            res.send({error: true})
        }
    })
}

const fileSize = (req, res) => {
    const list = req.body.directoryList
    let size = 0
    for(const file of list){
        size += fs.statSync(path.join(req.body.appendedPath, file)).size
    }
    res.send({size: size.toString()})
}

const fileCount = (req, res) => {
    res.send({count: req.body.directoryList.length})
}

const deleteFiles = (req, res) => {
    rimraf(req.body.appendedPath, (err) => {
        res.send({deleted: !err})
    })
}

const deleteFilesBasedOnList = (req, res) => {
    const list = req.body.directoryList
    /* for(const file of list){
        fs.unlinkSync(path.join(req.body.appendedPath, file))
    } */
    Promise.all(list.map(file =>
        new Promise((resolve, reject) => {
            fs.unlink(path.join(req.body.appendedPath, file), err => { 
                if (err) {
                    reject(err)
                }
                else{
                    resolve('nice')
                }
            })
        }).then(() => {
            res.send({deleted: list.length > 0})
        }, () => {
            res.send({error: true})
        })
    ))
    
}

const directoryFilter = (req, res, next) => {
    const list = req.body.directoryList
    req.body.directoryList = list.filter(file => {
        return moment(fs.statSync(path.join(req.body.appendedPath, file)).birthtime).isBefore(moment().subtract(req.body.days, "days"))
    })
    next()
}

app.post('/pathSize', validateBody, validateCameraAndAppendToPath, directoryList, fileSize) 
app.post('/pathFileCount', validateBody, validateCameraAndAppendToPath, directoryList, fileCount)
app.post('/pathDelete', validateBody, validateCameraAndAppendToPath, deleteFiles) 
app.post('/pathClean', validateBody, validateCameraAndAppendToPath, validateDays, directoryList, directoryFilter, deleteFilesBasedOnList) 

module.exports = app