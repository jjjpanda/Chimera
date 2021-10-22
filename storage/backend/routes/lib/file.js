const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const moment = require('moment')

module.exports = {
    validateCameraAndAppendToPath: (req, res, next) => {
        const {camera} = req.body
        if(camera){
            req.body.appendedPath = path.join(process.env.storage_FILEPATH, "./shared/captures/", camera)
            next()
        }
        else{
            res.send({error: "No camera number provided"})
        }
    },
    
    validateDays: (req, res, next) => {
        const {days} = req.body
        if(days != null){
            next()
        }
        else{
            res.send({error: "number of days not provided"})
        }
    },
    
    directoryList: (req, res, next) => {
        listFilesInDirectory(req.body.appendedPath, (err, files) => {
            if(!err) {
                req.body.directoryList = files.map(file => path.join(req.body.appendedPath, file))
                next()
            }
            else{
                res.send({error: true})
            }
        })
    },
    
    fileSize: (req, res) => {
        const list = req.body.directoryList
        getFileSize(list, (fileSize) => {
            res.send({size: fileSize.size, confidence: fileSize.confidence})
        })
    },
    
    fileCount: (req, res) => {
        res.send({count: req.body.directoryList.length})
    },
    
    deleteFiles: (req, res) => {
        rimraf(req.body.appendedPath, (err) => {
            res.send({deleted: !err})
        })
    },
    
    deleteFilesBasedOnCreationTime: (req, res) => {
        const list = req.body.directoryList
        const checkDate = moment().subtract(req.body.days, "days")
        if(list.length > 0){
            deleteFilesBasedOnCondition(list, checkIfFileWasCreatedBefore(checkDate), (stats) => {
                res.send({deleted: list.length > 0, confidence: stats.successful})
            })
        }
        else{
            res.send({error: true})
        }
    }
}

const listFilesInDirectory = (pathToDir, callback)=> {
    fs.readdir(pathToDir, callback)
}

const getFileSize = (fileList, callback) => {
    let size = 0
    let numberOfFilesCounted = 0
    Promise.all(fileList.map(file => {
        return new Promise((resolve) => {
            fs.stat(file, (err, stats) => {
                if(!err){
                    size += stats.size
                    numberOfFilesCounted ++
                }
                resolve()
            })
        })
    })).then(() => {
        callback({
            size: size.toString(), 
            confidence: 100*numberOfFilesCounted/fileList.length,
            bytes: size
        })
    })
}

const deleteFilesBasedOnCondition = (fileList, conditionalCheck, callback) => {
    let numberOfFilesDeleted = 0
    Promise.all(fileList.map(file =>
        new Promise((resolve) => {
            conditionalCheck(file, (conditionMet) => {
                if(conditionMet){
                    fs.unlink(file, (err) => { 
                        if (!err) {
                            numberOfFilesDeleted++
                        }
                        resolve()
                    })
                }
            })
        })
    )).then(() => {
        callback({successful: 100*numberOfFilesDeleted/fileList.length})
    })
}

const checkIfFileWasCreatedBefore = (checkDate) => (file, callback) => {
    fs.stat(file, (error, stats) => {
        callback(!error && moment(stats.birthtime).isBefore(checkDate))
    })
}