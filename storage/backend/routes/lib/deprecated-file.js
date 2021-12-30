const path = require("path")
const fs = require("fs")
const rimraf = require("rimraf")
const moment = require("moment")
const mkdirp = require("mkdirp")
const { formatBytes, jsonFileHanding, isPrimeInstance } = require("lib")
const {readJSON, writeJSON} = jsonFileHanding

const pathToAdditionStatsJSON = path.join(process.env.storage_FOLDERPATH, "./shared/additionStats.json")
const pathToDeletionStatsJSON = path.join(process.env.storage_FOLDERPATH, "./shared/deletionStats.json")
const pathToCumulativeStatsJSON = path.join(process.env.storage_FOLDERPATH, "./shared/cumulativeStats.json")
const cronMinutes = process.env.storage_fileStatsUpdateTime

module.exports = {
	summaryMetricsDirectoryList: (req, res, next) => {
		req.body.appendedPath = path.join(process.env.storage_FOLDERPATH, "./shared/captures/")
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
		readJSON(pathToCumulativeStatsJSON, (err, data) => {
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
			console.log("get cached file data", err)
			res.send({error: true})
		})
	},

	fileStats: (req, res) => {
		res.redirect(303, "/shared/additionStats.json")
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

const updateCacheAfterDeletion = (res, cacheUpdatingFunction, percentageDeleted, cameraIndex) => {
	Promise.all(deletionReadPromises()).then(([deletionData, cumulativeData]) => {
		const {newDeletionData, newCumulativeData} = cacheUpdatingFunction(deletionData, cumulativeData, percentageDeleted, cameraIndex)
		Promise.all(deletionWritePromises(newDeletionData, newCumulativeData)).then(() => {
			res.send({deleted: true})
		}, (err) => {
			res.send({deleted: true, msg: "JSON write failed"})
		})
	}, (err) => {
		console.log("update cache", err)
		res.send({deleted: true, msg: "JSON read failed"})
	})
}

const deleteStatsObjHandler = (deletionData, cumulativeData, percentageDeleted, cameraIndex) => {
	const cameras = JSON.parse(process.env.cameras)
	const deletionObj = {timestamp: moment().format("x"), camera: cameraIndex+1}
	for(const metric in cumulativeData){
		const metricDeleted = Math.round(parseInt(cumulativeData[metric][cameras[cameraIndex]]) * percentageDeleted)
		deletionObj[metric] = metricDeleted
		cumulativeData[metric][cameras[cameraIndex]] = cumulativeData[metric][cameras[cameraIndex]] - metricDeleted
	}
	if("deletions" in deletionData){
		deletionData.deletions.push(deletionObj)
	}
	else{
		deletionData.deletions = [deletionObj]
	}
	return {newDeletionData: deletionData, newCumulativeData: cumulativeData}
}

const deletionReadPromises = () => [pathToDeletionStatsJSON, pathToCumulativeStatsJSON].map(pathToStats => new Promise((resolve, reject) => {
	readJSON(pathToStats, (err, data) => {
		if(!err){
			resolve(data)
		}
		else{
			reject(err)
		}
	})
}))

const deletionWritePromises = (deletionData, cumulativeData) => {
	return [{pathToStats: pathToDeletionStatsJSON, data: deletionData}, 
		{pathToStats: pathToCumulativeStatsJSON, data: cumulativeData}].map(({pathToStats, data}) => new Promise((resolve, reject) => {
		writeJSON(pathToStats, data, (err) => {
			if(!err){
				resolve()
			}
			else{
				reject(err)
			}
		})
	}))
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
	return moment(fileName, require("./dateFormat.js")).isBefore(checkDate)
}

const filterFileCreatedAfter = (checkDate) => (file) => {
	const fileName = path.parse(path.basename(file)).name
	return moment(fileName, require("./dateFormat.js")).isAfter(checkDate)
}

const createStatsJSON = (filePath) => {
	readJSON(filePath, (err, data) => {
		if(err){
			writeJSON(filePath, {}, ()=>{}, (err) => {
				console.log("creation JSON write", err)
			})
		}
	})
}

const createTimestampedStatObject = () => {
	const timestamp = moment().format("x")
	let stats = { count: {timestamp}, size: {timestamp} }
	JSON.parse(process.env.cameras).forEach((name) => {
		stats.count[`${name}`] = 0
		stats.size[`${name}`] = 0
	})
	return stats
}

const promiseMetricTasks = (statsObj, cronMinutes=undefined) => JSON.parse(process.env.cameras).map((name, i) => {
	const camera = i+1
	return {name, pathToDir: path.join(process.env.storage_FOLDERPATH, "./shared/captures/", camera.toString())}
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
	])
}, [])

const cronTask = () => {
	console.log("SCHEDULED FILE STATS")
	let currentStats = createTimestampedStatObject()
	Promise.all(promiseMetricTasks(currentStats, cronMinutes)).then(() => {
		readJSON(pathToAdditionStatsJSON, (err, data) => {
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
		readJSON(pathToCumulativeStatsJSON, (err, data) => {
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
}

const cronString = `*/${cronMinutes} * * * *`

if(isPrimeInstance){
	const client = require("memory").client("FILE STATS")
	mkdirp(path.join(process.env.storage_FOLDERPATH, "./shared")).then(() => {
		createStatsJSON(pathToAdditionStatsJSON)
		createStatsJSON(pathToDeletionStatsJSON)
		createStatsJSON(pathToCumulativeStatsJSON)
	})
	client.on("file-stats-update", cronTask)
	client.emit("cron", cronString, "file-stats-update")
}