const path = require("path")
const fs = require("fs")
const { execFile } = require("child_process")
const rimraf = require("rimraf")
const moment = require("moment")
const { loadCameras, webhookAlert } = require("lib")

const Pool = require("pg").Pool
const pool = new Pool({
	user: process.env.database_USER,
	host: process.env.database_HOST,
	database: process.env.database_NAME,
	password: process.env.database_PASSWORD,
	port: process.env.database_PORT,
})

pool.on("error", (err) => {
	console.log("STORAGE FILE POOL ERROR", err)
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
		if(days != null && days >= 1){
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
			beforeDate = moment.utc().subtract(days, "days").format("YYYY-MM-DD HH:mm:ss")
		}
		queryToUpdateDatabaseForDeletion(camera, filesOrDirectory, beforeDate).then(deletedValues => {
			const sumSize = deletedValues.rows.reduce((sum, row) => {
				return sum + parseInt(row.size)
			}, 0)
			return queryToAddToDeletionsTable(camera, sumSize, deletedValues.rows.length)
				.then(insertedValues => {
					req.numberOfFilesDeletedInDatabase = deletedValues.rows.length
					req.deletedFileNames = deletedValues.rows.map(row => row.name)
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
		if(req.numberOfFilesDeletedInDatabase == 0){
			return res.send({deleted: false})
		}
		const names = req.deletedFileNames || []
		Promise.all(names.map(name =>
			fs.promises.unlink(path.join(req.body.appendedPath, name)).catch(() => {})
		)).then(() => res.send({deleted: true}))
	},

	dailyStats: (req, res) => {
		const cameras = loadCameras()
		if(cameras.length == 0) return res.send([])
		queryForDailyStats(cameras).then(values => {
			const stats = values.rows.map(row => ({
				timestamp: moment(row.timestamp).valueOf(),
				...cameras.reduce((obj, { name }) => ({ ...obj, [name]: parseInt(row[name]) || 0 }), {})
			}))
			res.send(stats)
		}).catch(err => {
			console.log("err", err)
			res.status(500).send({ error: true })
		})
	},

	fileStats: (req, res) => {
		const cameras = loadCameras()
		if(cameras.length == 0) return res.send([])
		queryForGroupedStats(cameras).then(values => {
			let fileStats = values.rows.map(row => ({
				timestamp: moment(row.timestamp).valueOf(),
				...cameras.reduce((obj, { name }) => ({
					...obj,
					[name]: parseInt(row[name])
				}), {})
			}))
			res.send(fileStats)
		}).catch(err => {
			console.log("err", err)
			res.status(500).send({ error: true })
		})
	},

	autoClean: async (req, res) => {
		try {
			const maxGb = parseFloat(process.env.storage_MAX_GB) || 0
			if (!maxGb) return res.send({ skipped: true })

			const capturesPath = path.join(process.env.storage_FOLDERPATH, "shared/captures")

			const usedBytes = await new Promise(resolve =>
				execFile("du", ["-sb", capturesPath], (err, stdout) =>
					resolve(err ? 0 : parseInt(stdout.split("\t")[0]) || 0)
				)
			)

			const targetBytes = maxGb * 0.9 * 1e9
			if (usedBytes <= targetBytes) return res.send({ cleaned: false })

			const toFree = usedBytes - targetBytes

			const { rows: frameTotalRows } = await pool.query(
				"SELECT COALESCE(SUM(size), 0) AS total FROM frame_files WHERE size IS NOT NULL AND size > 0"
			)
			const frameTotal = parseInt(frameTotalRows[0].total) || 0
			if (toFree >= frameTotal) {
				webhookAlert(`⚠️ Storage over ${maxGb}GB cap but non-frame artifacts (videos/zips) dominate — deleting all frames would not reach target, so auto-clean was skipped.`, "admin")
				return res.send({ cleaned: false })
			}

			let freed = 0
			let deleted = 0

			while (freed < toFree) {
				const { rows } = await pool.query(
					"SELECT id, camera, name, size FROM frame_files WHERE size IS NOT NULL AND size > 0 ORDER BY timestamp ASC LIMIT 10000"
				)
				if (rows.length === 0) break

				const batch = []
				for (const row of rows) {
					if (freed >= toFree) break
					batch.push(row)
					freed += parseInt(row.size) || 0
				}

				await Promise.all(batch.map(row =>
					fs.promises.unlink(path.join(capturesPath, row.camera.toString(), row.name)).catch(() => {})
				))
				await pool.query("DELETE FROM frame_files WHERE id = ANY($1::int[])", [batch.map(r => r.id)])
				deleted += batch.length

				if (batch.length < rows.length) break
			}

			if (deleted === 0) return res.send({ cleaned: false })
			res.send({ cleaned: true, deleted })
		} catch (err) {
			res.status(500).send({ error: "cleanup failed" })
		}
	},

	cameraMetrics: (req, res) => {
		const cameras = loadCameras()

		const sizePromises = Promise.all(cameras.map(({ id }) => {
			return queryForMetric(id, "size").then(extractValueForMetric("size"))
		}))

		const countPromises = Promise.all(cameras.map(({ id }) => {
			return queryForMetric(id, "count").then(extractValueForMetric("count"))
		}))

		Promise.all([sizePromises, countPromises]).then(values => {
			let sizes = values[0]
			let counts = values[1]
			let metrics = { size: {}, count: {} }
			cameras.forEach(({ name }, index) => {
				metrics.size[name] = sizes[index] ? sizes[index] : 0
				metrics.count[name] = counts[index] ? counts[index] : 0
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
	const now = moment.utc().format("YYYY-MM-DD HH:mm:ss")
	return pool.query(`INSERT INTO frame_deletes(timestamp, camera, size, count) VALUES('${now}', ${camera}, ${size}, ${count});`)
}

const queryForDailyStats = (cameras) => {
	const cols = cameras.map(({ id, name }) => `SUM(CASE WHEN camera=${id} THEN size ELSE 0 END) as "${name.replace(/"/g, '""')}"`)
	return pool.query(`SELECT date_trunc('minute', timestamp) as timestamp,${cols.join(",")} FROM frame_files WHERE timestamp >= NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 1 ASC;`)
}

const queryForGroupedStats = (cameras) => {
	const arrayOfColumns = cameras.map(({ id, name }) => `SUM(CASE WHEN camera=${id} THEN size ELSE 0 END) as "${name.replace(/"/g, '""')}"`)
	return pool.query(`SELECT date_trunc('hour', timestamp) as timestamp,${arrayOfColumns.join(",")} FROM frame_files GROUP BY 1 ORDER BY 1 ASC;`)
}

const extractValueForMetric = (metric) => (values) => {
	let metricName
	switch (metric) {
	case "size":
		metricName = "sum"
		break
	default:
		metricName = metric
		break
	}
	if(values.rows && values.rows.length > 0){
		return values.rows[0][metricName] ? values.rows[0][metricName] : 0
	}
	else{
		throw new Error()
	}
}