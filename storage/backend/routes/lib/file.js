const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const moment = require('moment')
const mkdirp = require('mkdirp')
const cron = require('node-cron')
const { formatBytes, jsonFileHanding } = require('lib')
const {readJSON, writeJSON} = jsonFileHanding

const pathToAdditionStatsJSON = path.join(process.env.storage_FILEPATH, "./shared/additionStats.json")
const pathToDeletionStatsJSON = path.join(process.env.storage_FILEPATH, "./shared/deletionStats.json")
const pathToCumulativeStatsJSON = path.join(process.env.storage_FILEPATH, "./shared/cumulativeStats.json")
const cronMinutes = process.env.storage_fileStatsUpdateTime

module.exports = {
    validateCameraAndAppendToPath: (req, res, next) => {
        const {camera} = req.body
        if(parseInt(camera) == camera){
            req.body.appendedPath = path.join(process.env.storage_FILEPATH, "./shared/captures/", camera.toString())
            next()
        }
        else{
            res.send({error: "No camera number provided"})
        }
    },

    summaryMetricsDirectoryList: (req, res, next) => {
        req.body.appendedPath = path.join(process.env.storage_FILEPATH, "./shared/captures/")
        let fileLists = {}
        JSON.parse(process.env.cameras).map((name, index) => {
            const camera = index + 1
            listFilesInDirectory( path.join(req.body.appendedPath, camera.toString()) ).then((fileList) => {
                fileLists[camera] = fileList
            })
        })
        req.body.directoryLists = fileLists
        next()
    },

    summaryMetrics: (req, res) => {
        let metricsObj = createTimestampedStatObject()
        Promise.all(promiseMetricTasks(metricsObj)).then(() => {
            res.send(metricsObj)
        }, () => {
            res.send({error: true})
        })
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
        getDirectorySize(list).then(({size, confidence, bytes}) => {
            res.send({size, confidence, bytes})
        })
    },
    
    fileCount: (req, res) => {
        res.send({count: req.body.directoryList.length})
    },

    getCachedFileData: (metric) => (req, res) => {
        const cameras = JSON.parse(process.env.cameras)
        const {camera} = req.body
        readJSON(pathToCumulativeStatsJSON, (data) => {
            if(metric === "all"){
                res.send(data)
            }
            else if(metric in data){
                res.send({[metric]: data[metric][cameras[camera-1]]})
            }
            else{
                res.send({error: true})
            }
        }, (err) => {
            res.send({error: true})
        })
    },

    fileStats: (req, res) => {
        res.redirect('/shared/additionStats.json')
    },
    
    deleteFileDirectory: (req, res) => {
        const {camera} = req.body
        rimraf(req.body.appendedPath, (err) => {
            if(err){
                res.send({deleted: false, msg: "delete failed"})
            }
            else{
                updateCacheAfterDeletion(res, allDeleteStatsObjHandler, camera)
            }
        })
    },

    filterList: (timeCheck) => (req, res, next) => {
        const list = req.body.directoryList
        const checkDate = moment().subtract(req.body.days, "days")
        req.body.directoryListBeforeFilter = req.body.directoryList
        req.body.directoryList = filterFilesByTime(list, checkDate, timeCheck)
        next()
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
    },

    deleteFilesBeforeDateGlob: (req, res) => {
        const {days, camera} = req.body
        const now = moment()
        const beforeDate = moment().subtract(days, "days")
        const clobArr = generateBeforeDateGlobNotPatternsArray(now, beforeDate)
        if(clobArr.length == 0){
            res.send({deleted: false})
        }
        else{
            const glob = `./!(${clobArr.join('|')})*.jpg`
            const percentageDeleted = req.body.directoryList.length/req.body.directoryListBeforeFilter.length
            rimraf(path.join(req.body.appendedPath, glob), (err) => {
                if(err){
                    res.send({deleted: false})
                }
                else{
                    updateCacheAfterDeletion(res, filterDeleteStatsObjHandler, percentageDeleted, camera)
                }
            })
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

const updateCacheAfterDeletion = (res, cacheUpdatingFunction, ...args) => {
    Promise.all(deletionReadPromises).then(([deletionData, cumulativeData]) => {
        ({deletionData, cumulativeData} = cacheUpdatingFunction(deletionData, cumulativeData, ...args))
        Promise.all(deletionWritePromises(deletionData, cumulativeData)).then(() => {
            res.send({deleted: true})
        }, (err) => {
            res.send({deleted: true, msg: "JSON write failed"})
        })
    }, (err) => {
        res.send({deleted: true, msg: "JSON read failed"})
    })
}

const allDeleteStatsObjHandler = (deletionData, cumulativeData, camera) => {
    const cameras = JSON.parse(process.env.cameras)
    const deletionObj = {timestamp: moment().format('x'), camera}
    for(const metric in cumulativeData){
        deletionObj[metric] = cumulativeData[metric][cameras[camera]]
        cumulativeData[metric][cameras[camera]] = 0
    }
    if("deletions" in deletionData){
        deletionData.deletions.push(deletionObj)
    }
    else{
        deletionData.deletions = [deletionObj]
    }
    return {deletionData, cumulativeData}
}

const filterDeleteStatsObjHandler = (deletionData, cumulativeData, percentageDeleted, camera) => {
    const cameras = JSON.parse(process.env.cameras)
    const deletionObj = {timestamp: moment().format('x'), camera}
    for(const metric in cumulativeData){
        const metricDeleted = Math.round(cumulativeData[metric][cameras[camera]] * percentageDeleted)
        deletionObj[metric] = metricDeleted
        cumulativeData[metric][cameras[camera]] = cumulativeData[metric][cameras[camera]] - metricDeleted
    }
    if("deletions" in deletionData){
        deletionData.deletions.push(deletionObj)
    }
    else{
        deletionData.deletions = [deletionObj]
    }
    return {deletionData, cumulativeData}
}

const deletionReadPromises = [
    new Promise((resolve, reject) => {
        readJSON(pathToDeletionStatsJSON, (data, err) => {
            if(!err){
                resolve(data)
            }
            else{
                reject()
            }
        })
    }),
    new Promise((resolve, reject) => {
        readJSON(pathToCumulativeStatsJSON, (data, err) => {
            if(!err){
                resolve(data)
            }
            else{
                reject()
            }
        })
    })
]
const deletionWritePromises = (deletionData, cumulativeData) => [
    new Promise((resolve, reject) => {
        writeJSON(pathToDeletionStatsJSON, deletionData, (err) => {
            if(!err){
                resolve()
            }
            else{
                reject(err)
            }
        })
    }),
    new Promise((resolve, reject) => {
        writeJSON(pathToCumulativeStatsJSON, cumulativeData, (err) => {
            if(!err){
                resolve()
            }
            else{
                reject(err)
            }
        })
    })
]

const generateBeforeDateGlobNotPatternsArray = (now, beforeDate, arr=[]) => {
    if(now.year() > beforeDate.year()){
        const str = now.format("YYYY")
        return [...arr, str, ...generateBeforeDateGlobNotPatternsArray(moment(now).subtract(1, "year"), beforeDate)]
    }
    else if(now.month() > beforeDate.month()){
        const str = now.format("YYYYMM")
        return [...arr, str, ...generateBeforeDateGlobNotPatternsArray(moment(now).subtract(1, "month"), beforeDate)]
    }
    else if(now.date() > beforeDate.date()){
        const str = now.format("YYYYMMDD")
        return [...arr, str, ...generateBeforeDateGlobNotPatternsArray(moment(now).subtract(1, "day"), beforeDate)]
    }
    else if(now.hour() > beforeDate.hour()){
        const str = now.format("YYYYMM-HH")
        return [...arr, str, ...generateBeforeDateGlobNotPatternsArray(moment(now).subtract(1, "hour"), beforeDate)]
    }
    else if(now.minute() > beforeDate.minute()){
        const str = now.format("YYYYMM-HHmm")
        return [...arr, str, ...generateBeforeDateGlobNotPatternsArray(moment(now).subtract(1, "minute"), beforeDate)]
    }
    else if(now.second() > beforeDate.second()){
        const str = now.format("YYYYMM-HHmmss")
        return [...arr, str, ...generateBeforeDateGlobNotPatternsArray(moment(now).subtract(1, "second"), beforeDate)]
    }
    else{
        return arr
    }
}

const getDirectorySize = (fileList) => {
    return Promise.all(fileList.map(file => {
        return new Promise((resolve) => {
            fs.stat(file, (err, stats) => {
                if(!err){
                    resolve({size: stats.size, counted: true})
                }
                else{
                    resolve({size: 0, counted: false})
                }
            })
        })
    })).then((reasons) => {
        let size = 0
        let numberOfFilesCounted = 0
        reasons.forEach((reason) => {
            size+=reason.size
            numberOfFilesCounted+=reason.counted ? 1 : 0
        })
        return {
            size: formatBytes(size), 
            confidence: 100*numberOfFilesCounted/fileList.length,
            bytes: size
        }
    })
}

const deleteFiles = (fileList) => {
    return Promise.all(fileList.map(file =>
        new Promise((resolve) => {
            fs.unlink(file, (err) => { 
                if (!err) {
                    resolve(1)
                }
                else{
                    resolve(0)
                }
            })
        })
    )).then((reasons) => {
        let numberOfFilesDeleted = 0
        reasons.forEach((reason) => {
            numberOfFilesDeleted+=reason 
        })
        return {successful: 100*numberOfFilesDeleted/fileList.length}
    })
}

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

const createStatsJSON = (filePath) => {
    readJSON(filePath, (data, err) => {
        if(err){
            writeJSON(filePath, {}, ()=>{}, (err) => {
                console.log(err);
            })
        }
    })
}

mkdirp(path.join(process.env.storage_FILEPATH, `./shared`)).then(() => {
    createStatsJSON(pathToAdditionStatsJSON)
    createStatsJSON(pathToDeletionStatsJSON)
    createStatsJSON(pathToCumulativeStatsJSON)
})

const createTimestampedStatObject = () => {
    const timestamp = moment().format('x')
    let stats = { count: {timestamp}, size: {timestamp} }
    JSON.parse(process.env.cameras).forEach((name) => {
        stats.count[`${name}`] = 0
        stats.size[`${name}`] = 0
    })
    return stats
}

const promiseMetricTasks = (statsObj, cronMinutes=undefined) => JSON.parse(process.env.cameras).map((name, i) => {
    const camera = i+1
    return {name, pathToDir: path.join(process.env.storage_FILEPATH, "./shared/captures/", camera.toString())}
}).reduce(function (accumulator, {name, pathToDir}) {
    return accumulator.concat([
        new Promise(resolve => {
            listFilesInDirectory(pathToDir).then((fileList) => {
                let filteredFileList = fileList
                if(cronMinutes){
                    filteredFileList = filterFilesByTime(filteredFileList, moment(statsObj.count.timestamp, "x").subtract(cronMinutes, "minutes"), "after")
                    filteredFileList = filterFilesByTime(filteredFileList, moment(statsObj.count.timestamp, "x"), "before")
                }
                statsObj.count[`${name}`] = filteredFileList.length
                resolve()
            })
        }),
        new Promise((resolve, reject) => {
            listFilesInDirectory(pathToDir).then((fileList) => {
                let filteredFileList = fileList
                if(cronMinutes){
                    filteredFileList = filterFilesByTime(filteredFileList, moment(statsObj.count.timestamp, "x").subtract(cronMinutes, "minutes"), "after")
                    filteredFileList = filterFilesByTime(filteredFileList, moment(statsObj.count.timestamp, "x"), "before")
                }
                getDirectorySize(filteredFileList).then(({bytes}) => {
                    statsObj.size[`${name}`] = bytes
                    resolve()
                }, () => {
                    reject()
                })
            })
        })
    ]);
}, [])

cron.schedule(`*/${cronMinutes} * * * *`, () => {
    let currentStats = createTimestampedStatObject()
    Promise.all(promiseMetricTasks(currentStats, cronMinutes)).then(() => {
        readJSON(pathToAdditionStatsJSON, (data) => {
            for(const metric in currentStats){
                if(!(metric in data)){
                    data[metric] = []
                }
                data[metric].push(currentStats[metric])
            }
            writeJSON(pathToAdditionStatsJSON, data, (err) => {
                if(err){
                    console.log("\twriting file stats to addition JSON | Error:", err)
                }
            })
        })
        readJSON(pathToCumulativeStatsJSON, (data) => {
            for(const metric in currentStats){
                if(!(metric in data)){
                    data[metric] = {}
                }
                for(const camera of JSON.parse(process.env.cameras)){
                    if(data[metric][camera] != undefined){
                        data[metric][camera] += currentStats[metric][camera]
                    }
                    else{
                        data[metric][camera] = currentStats[metric][camera]
                    }
                }
            }
            writeJSON(pathToCumulativeStatsJSON, data, (err) => {
                if(err){
                    console.log("\twriting file stats to cumulative JSON | Error:", err)
                }    
            })
        })
    }, (err) => {
        console.log("\tcouldn't write file stats to JSONs | Error:", err)
    })
})