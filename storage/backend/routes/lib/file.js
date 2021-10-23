const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const moment = require('moment')
const cron = require('node-cron')

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
    
    deleteFiles: (req, res) => {
        rimraf(req.body.appendedPath, (err) => {
            res.send({deleted: !err})
        })
    },
    
    deleteFilesBasedOnCreationTime: (req, res) => {
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

const deleteFilesBasedOnCondition = (fileList, conditionalCheck) => {
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
}

// stats is unnecessary because of timestamp in filename, 
// and can be replaced with simple array filter
const checkIfFileWasCreatedBefore = (checkDate) => (file) => {
    return new Promise((resolve) => fs.stat(file, (error, stats) => {
        resolve(!error && moment(stats.birthtime).isBefore(checkDate))
    }))
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
    fs.readFile(filePath, (err, data) => {
      if (err || !isStringJSON(data)) {
        fs.writeFile(filePath, JSON.stringify([]), (err) => {
            if(err) {
                console.log(err);
            }
        });
      } 
    });
}

const pathToStatsJSON = path.join(process.env.storage_FILEPATH, "./shared/additionStats.json")
createStatsJSON(pathToStatsJSON)

const currentStats = {}
JSON.parse(process.env.cameras).forEach((name) => {
    currentStats[name] = {}
})

const promiseTasks = JSON.parse(process.env.cameras).map((name, i) => {
    const camera = i+1
    return {name, pathToDir: path.join(process.env.storage_FILEPATH, "./shared/captures/", camera.toString())}
}).reduce(function (accumulator, {name, pathToDir}) {
    return accumulator.concat([
        new Promise(resolve => {
            listFilesInDirectory(pathToDir).then((fileList) => {
                currentStats[name].count = fileList.length
                resolve()
            })
        }),
        new Promise(resolve => {
            listFilesInDirectory(pathToDir).then((fileList) => {
                getDirectorySize(fileList).then(({bytes}) => {
                    currentStats[name].size = bytes
                })
                resolve()
            })
        })
    ]);
}, [])

cron.schedule('*/10 * * * *', () => {
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