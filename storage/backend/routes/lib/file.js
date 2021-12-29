const path = require("path")
const rimraf = require("rimraf")
const moment = require("moment")

const Pool = require('pg').Pool
const pool = new Pool({
    user: process.env.database_USER,
    host: process.env.database_HOST,
    database: process.env.database_NAME,
    password: process.env.database_PASSWORD,
    port: process.env.database_PORT,
})

module.exports = {
    validateCameraAndAppendToPath: (req, res, next) => {
		const {camera} = req.body
		if(parseInt(camera) == camera){
			req.body.appendedPath = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", camera.toString())
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

    getCameraMetricFromDatabase: (metric) => (req, res) => {
		const {camera} = req.body
		queryForMetric(camera, metric)
        .then(extractValueForMetric(metric))
        .then(extractedValue => {
            res.send({[metric]: extractedValue})
        })
        .catch(err => {
            res.status(400).send({error: true})
        })
	},

    updateDeletionOfFiles: (filesOrDirectory) => (req, res, next) => {
        const {camera} = req.body
        let beforeDate = ""
        if(filesOrDirectory == "files"){
            let {days} = req.body
            beforeDate = moment().subtract(days, "days").format('YYYY-MM-DD HH:mm:ss');
        }
        queryToUpdateDatabaseForDeletion(camera, filesOrDirectory, beforeDate).then(deletedValues => {
            const sumSize = deletedValues.rows.reduce((sum, row) => {
                return sum + parseInt(row.size)
            }, 0);
            return queryToAddToDeletionsTable(camera, sumSize, deletedValues.rows.length)
                .then(insertedValues => {
                    req.numberOfFilesDeletedInDatabase = deletedValues.rows.length
                    next()
                })
        }).catch(err => {
            console.log(err)
        })
    },

    deleteFileDirectory: (req, res) => {
		rimraf(req.body.appendedPath, (err) => {
			res.send({deleted: !err && req.numberOfFilesDeletedInDatabase > 0})
		})
	},

    deleteFilesBeforeDateGlob: (req, res) => {
		const {days} = req.body
		const now = moment()
		const beforeDate = moment().subtract(days, "days")
		const clobArr = generateBeforeDateGlobNotPatternsArray(now, beforeDate)
		if(clobArr.length == 0 || req.numberOfFilesDeletedInDatabase == 0){
			res.send({deleted: false})
		}
		else{
			const glob = `./!(${clobArr.join("|")})*.jpg`
			rimraf(path.join(req.body.appendedPath, glob), (err) => {
				res.send({deleted: !err})
			})
		}
	},

    fileStats: (req, res) => {
        const cameras = JSON.parse(process.env.cameras)
        Promise.all(cameras.map((camera, index) => {
            return queryForGroupedStats(index+1)
        })).then(values => {
            let stats = {}
            cameras.forEach((camera, index) => {
                stats[camera] = values[index].rows
            })
            res.send(stats)
        }).catch(err => {
            console.log("err", err)
        })
    },

    cameraMetrics: (req, res) => {
        const cameras = JSON.parse(process.env.cameras)

        const sizePromises = Promise.all(cameras.map((camera, index) => {
            return queryForMetric(index+1, "size").then(extractValueForMetric("size"))
        }));

        const countPromises = Promise.all(cameras.map((camera, index) => {
            return queryForMetric(index+1, "count").then(extractValueForMetric("count"))
        }));

        Promise.all([sizePromises, countPromises]).then(values => {
            let sizes = values[0]
            let counts = values[1]
            let metrics = { size: {}, count: {} }
            cameras.forEach((camera, index) => {
                metrics.size[camera] = sizes[index] ? sizes[index] : 0
                metrics.count[camera] = counts[index] ? counts[index] : 0
            })
            res.send(metrics)
        }).catch(err => {
            console.log("err", err)
        })
    }
}

const queryForMetric = (camera, metric) => {
    return pool.query(`SELECT ${metric == "count" ? "COUNT(*)" : "SUM(size)"} FROM frame_files WHERE camera=${camera};`)
}

const queryToUpdateDatabaseForDeletion = (camera, deleting, before="") => {
    const timestampCondition = deleting=="files" ? `AND timestamp<=timestamp '${before}'` : ""
    return pool.query(`DELETE FROM frame_files WHERE camera=${camera} ${timestampCondition} RETURNING *;`)
}

const queryToAddToDeletionsTable = (camera, size, count) => {
    const now = moment().format('YYYY-MM-DD HH:mm:ss')
    return pool.query(`INSERT INTO frame_deletes(timestamp, camera, size, count) VALUES('${now}', ${camera}, ${size}, ${count});`)
}

const queryForGroupedStats = (camera) => {
    return pool.query(`SELECT timestamp,SUM(size), COUNT(*) FROM frame_files WHERE camera=${camera} GROUP BY timestamp ORDER BY timestamp ASC;`)
}

const extractValueForMetric = (metric) => (values) => {
    let metricName
    switch (metric) {
        case "size":
            metricName = "sum";
            break;
        default:
            metricName = metric;
            break;
    }
    if(values.rows && values.rows.length > 0){
        return values.rows[0][metricName] ? values.rows[0][metricName] : 0
    }
    else{ 
        throw new Error()
    }
} 

const generateBeforeDateGlobNotPatternsArray = (now, beforeDate, arr=[]) => {
	const units = [
		{unit: "y", format: "YYYY"}, 
		{unit: "M", format: "YYYYMM"}, 
		{unit: "d", format: "YYYYMMDD"}, 
		{unit: "h", format: "YYYYMM-HH"}, 
		{unit: "m", format: "YYYYMM-HHmm"}, 
		{unit: "s", format: "YYYYMM-HHmmss"}
	]
	for(const {unit, format} of units){
		if(now.diff(beforeDate, unit) >= 1){
			const str = now.format(format)
			return [...arr, str, ...generateBeforeDateGlobNotPatternsArray(moment(now).subtract(1, unit), beforeDate)]
		}
	}
	return arr
}