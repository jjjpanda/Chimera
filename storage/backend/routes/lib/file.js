const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const moment = require('moment')
const mkdirp = require('mkdirp')
const cron = require('node-cron')

module.exports = {
    validateCameraAndAppendToPath: (req, res, next) => {
        const {camera} = req.body
        if(camera || parseInt(camera) == camera){
            req.body.appendedPath = path.join(process.env.storage_FILEPATH, "./shared/captures/", camera.toString())
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
        listFilesInDirectory(req.body.appendedPath).then((fileList) => {
            req.body.directoryList = fileList
            next()
        })
    },
    
    fileSize: (req, res) => {
        const list = req.body.directoryList
        getDirectorySize(list).then((fileSize) => {
            res.send({size: fileSize.size, confidence: fileSize.confidence})
        })
    },
    
    fileCount: (req, res) => {
        res.send({count: req.body.directoryList.length})
    },
    
    deleteFileDirectory: (req, res) => {
        rimraf(req.body.appendedPath, (err) => {
            res.send({deleted: !err})
        })
    },
    
    /* deleteFilesBasedOnCreationTime: (req, res) => {
        const list = req.body.directoryList
        const checkDate = moment().subtract(req.body.days, "days")
        if(list.length > 0){
            deleteFilesBasedOnCondition(list, checkIfFileWasCreatedBefore(checkDate)).then((stats) => {
                res.send({deleted: list.length > 0, confidence: stats.successful})
            })
        }
        else{
            res.send({error: true})
        }
    }, */

    filterList: (timeCheck) => (req, res, next) => {
        const list = req.body.directoryList
        const checkDate = moment().subtract(req.body.days, "days")
        req.body.directoryList = filterFilesByTime(list, checkDate, timeCheck)
    },

    deleteFileList: (req, res) => {
        const list = req.body.directoryList
        if(list.length > 0){
            deleteFiles(list).then((stats) => {
                res.send({deleted: list.length > 0, confidence: stats.successful})
            })
        }
        else{
            res.send({error: true})
        }
    }
}

const listFilesInDirectory = (pathToDir) => {
    return new Promise((resolve) => fs.readdir(pathToDir, (err, files) => {
        let list = []
        if(!err) {
            list = files.map(file => path.join(pathToDir, file))
        }
        resolve(list)
    }))
}

const getDirectorySize = (fileList) => {
    let size = 0
    let numberOfFilesCounted = 0
    return Promise.all(fileList.map(file => {
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
        return {
            size: size.toString(), 
            confidence: 100*numberOfFilesCounted/fileList.length,
            bytes: size
        }
    })
}

/* const deleteFilesBasedOnCondition = (fileList, conditionalCheck) => {
    let numberOfFilesDeleted = 0
    return Promise.all(fileList.map(file =>
        new Promise((resolve) => {
            conditionalCheck(file).then((conditionMet) => {
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
        return {successful: 100*numberOfFilesDeleted/fileList.length}
    })
} */

const deleteFiles = (fileList) => {
    let numberOfFilesDeleted = 0
    return Promise.all(fileList.map(file =>
        new Promise((resolve) => {
            fs.unlink(file, (err) => { 
                if (!err) {
                    numberOfFilesDeleted++
                }
                resolve()
            })
        })
    )).then(() => {
        return {successful: 100*numberOfFilesDeleted/fileList.length}
    })
}

/* const checkIfFileWasCreatedBefore = (checkDate) => (file) => {
    return new Promise((resolve) => fs.stat(file, (error, stats) => {
        resolve(!error && moment(stats.birthtime).isBefore(checkDate))
    }))
} */

const filterFilesByTime = (fileList, checkDate, timeCheck="before") => {
    return fileList.filter(timeCheck == "before" ? filterFileCreatedBefore(checkDate) : filterFileCreatedAfter(checkDate))
}

const filterFileCreatedBefore = (checkDate) => (file) => {
    const fileName = path.parse(path.basename(file)).name
    return moment(fileName, require('./dateFormat.js')).isBefore(checkDate)
}

const filterFileCreatedAfter = (checkDate) => (file) => {
    const fileName = path.parse(path.basename(file)).name
    return moment(fileName, require('./dateFormat.js')).isAfter(checkDate)
}

const isStringJSON = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

const createStatsJSON = (filePath) => {
    mkdirp(`${process.env.storage_FILEPATH}shared`).then(() => {
        fs.readFile(filePath, (err, data) => {
            if (err || !isStringJSON(data)) {
              fs.writeFile(filePath, JSON.stringify([]), (err) => {
                  if(err) {
                      console.log(err);
                  }
              });
            } 
        });
    })
}

const pathToStatsJSON = path.join(process.env.storage_FILEPATH, "./shared/additionStats.json")
createStatsJSON(pathToStatsJSON)

const createTimestampedStatObject = () => {
    let stats = {}
    JSON.parse(process.env.cameras).forEach((name) => {
        stats[name] = {timestamp: moment().format(require('./dateFormat.js'))}
    })
    return stats
}

let currentStats = createTimestampedStatObject()

const cronMinutes = 10

const promiseTasks = JSON.parse(process.env.cameras).map((name, i) => {
    const camera = i+1
    return {name, pathToDir: path.join(process.env.storage_FILEPATH, "./shared/captures/", camera.toString())}
}).reduce(function (accumulator, {name, pathToDir}) {
    return accumulator.concat([
        new Promise(resolve => {
            listFilesInDirectory(pathToDir).then((fileList) => {
                filteredFileList = filterFilesByTime(fileList, moment().subtract(cronMinutes, "minutes"), "after")
                currentStats[name].count = filteredFileList.length
                resolve()
            })
        }),
        new Promise(resolve => {
            listFilesInDirectory(pathToDir).then((fileList) => {
                filteredFileList = filterFilesByTime(fileList, moment().subtract(cronMinutes, "minutes"), "after")
                getDirectorySize(filteredFileList).then(({bytes}) => {
                    currentStats[name].size = bytes
                })
                resolve()
            })
        })
    ]);
}, [])

cron.schedule(`*/${cronMinutes} * * * *`, () => {
    let currentStats = createTimestampedStatObject()
    Promise.all(promiseTasks).then(() => {
        fs.readFile(pathToStatsJSON, (err, data) => {
            let jsonData = []
            if(!err && isStringJSON(data)){
                jsonData = JSON.parse(data)
            }
            jsonData.push(currentStats)
            fs.writeFile(pathToStatsJSON, JSON.stringify(jsonData), (err) => {
                console.log("\twriting file stats to JSON | Error:", err)
            })
        })
    })
})