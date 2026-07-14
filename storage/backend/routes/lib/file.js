const path = require("path")
const fs = require("fs")
const rimraf = require("rimraf")
const moment = require("moment")
const { loadCameras, webhookAlert, mapLimit } = require("lib")

const { pool, bulkPool } = require("../../lib/pool")
const { FS_CONCURRENCY, CAPTURES_DIR, OBJECT_CAPTURES_DIR, dirFileBytes } = require("../../lib/fsUsage")

const MAX_STUCK_BATCHES = 3

const camerasOrFail = (res) => loadCameras().catch(() => {
	res.status(500).send({ error: true })
	return null
})

module.exports = {
	validateCameraAndAppendToPath: (req, res, next) => {
		const camera = parseInt(req.body.camera)
		if(camera == req.body.camera){
			req.body.camera = camera
			req.body.appendedPath = path.join(CAPTURES_DIR, String(camera))
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
			.catch(() => {
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
		queryToDeleteAndRecord(camera, filesOrDirectory, beforeDate).then(deletedValues => {
			req.numberOfFilesDeletedInDatabase = deletedValues.rows.length
			req.deletedFileNames = deletedValues.rows.map(row => row.name)
			req.beforeDate = beforeDate
			next()
		}).catch(err => {
			console.log(err)
			res.status(500).send({ error: true })
		})
	},

	deleteFileDirectory: (req, res) => {
		rimraf(req.body.appendedPath, (err) => {
			res.send({deleted: !err && req.numberOfFilesDeletedInDatabase > 0})
		})
	},

	deleteFilesBeforeDateGlob: async (req, res) => {
		const dir = req.body.appendedPath
		const names = (req.deletedFileNames || []).filter(Boolean)
		const tracked = await mapLimit(names, FS_CONCURRENCY, name =>
			fs.promises.unlink(path.join(dir, path.basename(name))).then(() => true).catch((e) => e.code === "ENOENT")
		)
		if (req.beforeDate) {
			const cutoff = moment.utc(req.beforeDate).valueOf()
			const known = new Set(names.map(n => path.basename(n)))
			const entries = await fs.promises.readdir(dir).catch(() => [])
			const stale = entries.filter(f => f.endsWith(".jpg") && !known.has(f))
			await mapLimit(stale, FS_CONCURRENCY, async (f) => {
				const captured = moment.utc(f.slice(0, 15), "YYYYMMDD-HHmmss", true)
				if (captured.isValid() && captured.valueOf() < cutoff) await fs.promises.unlink(path.join(dir, f)).catch(() => {})
			})
		}
		const failed = tracked.filter(ok => !ok).length
		if (failed) console.log(`STORAGE FILE UNLINK FAILED for ${failed} file(s) after DB rows deleted; orphans will be swept on next clean`)
		res.send({ deleted: req.numberOfFilesDeletedInDatabase > 0 && failed === 0 })
	},

	dailyStats: async (req, res) => {
		const cameras = await camerasOrFail(res)
		if(!cameras) return
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

	fileStats: async (req, res) => {
		const cameras = await camerasOrFail(res)
		if(!cameras) return
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

			const { rows: frameTotalRows } = await bulkPool.query(
				"SELECT COALESCE(SUM(size), 0) AS total FROM frame_files WHERE size IS NOT NULL AND size > 0"
			)
			const frameTotal = parseInt(frameTotalRows[0].total) || 0

			const nonFrameBytes = await dirFileBytes(CAPTURES_DIR)
			const usedObjectBytes = await dirFileBytes(OBJECT_CAPTURES_DIR)
			const totalUsedBytes = frameTotal + nonFrameBytes + usedObjectBytes

			const targetBytes = maxGb * 0.9 * 1e9
			if (totalUsedBytes <= targetBytes) return res.send({ cleaned: false })

			const toFree = totalUsedBytes - targetBytes
			if (toFree >= frameTotal) {
				webhookAlert(`⚠️ Storage over ${maxGb}GB cap but non-frame artifacts (videos/zips) dominate — deleting all frames would not reach target, so auto-clean was skipped.`, "admin")
				return res.send({ cleaned: false })
			}

			let freed = 0
			let deleted = 0
			const stuck = []
			let stuckBatches = 0
			let page = []
			let cursor = 0

			while (freed < toFree) {
				if (cursor >= page.length) {
					const { rows } = await bulkPool.query(
						"SELECT id, camera, name, size FROM frame_files WHERE size IS NOT NULL AND size > 0 AND NOT (id = ANY($1::int[])) ORDER BY timestamp ASC LIMIT 10000",
						[stuck]
					)
					if (rows.length === 0) break
					page = rows
					cursor = 0
				}

				let planned = freed
				const batch = []
				while (cursor < page.length && planned < toFree) {
					const row = page[cursor++]
					batch.push(row)
					planned += parseInt(row.size) || 0
				}

				const removed = await mapLimit(batch, FS_CONCURRENCY, row =>
					fs.promises.unlink(path.join(CAPTURES_DIR, row.camera.toString(), row.name))
						.then(() => true)
						.catch((e) => e.code === "ENOENT")
				)
				const gone = batch.filter((row, i) => removed[i])
				batch.forEach((row, i) => { if (!removed[i]) stuck.push(row.id) })

				if (gone.length === 0) {
					if (++stuckBatches >= MAX_STUCK_BATCHES) break
					continue
				}
				stuckBatches = 0
				await bulkPool.query("DELETE FROM frame_files WHERE id = ANY($1::int[])", [gone.map(r => r.id)])
				gone.forEach(row => { freed += parseInt(row.size) || 0 })
				deleted += gone.length
			}

			if (stuck.length) {
				webhookAlert(`⚠️ Storage auto-clean could not unlink ${stuck.length} frame file(s); their rows were left intact. Check permissions on ${CAPTURES_DIR}.`, "admin")
			}
			if (deleted === 0) return res.send({ cleaned: false })
			res.send({ cleaned: true, deleted })
		} catch (err) {
			res.status(500).send({ error: "cleanup failed" })
		}
	},

	cameraMetrics: async (req, res) => {
		const cameras = await camerasOrFail(res)
		if (!cameras) return

		bulkPool.query("SELECT camera, COUNT(*) AS count, COALESCE(SUM(size), 0) AS size FROM frame_files GROUP BY camera").then(({ rows }) => {
			const byCamera = new Map(rows.map((r) => [String(r.camera), r]))
			const metrics = { size: {}, count: {} }
			cameras.forEach(({ id, name }) => {
				const row = byCamera.get(String(id))
				metrics.size[name] = row ? parseInt(row.size) || 0 : 0
				metrics.count[name] = row ? parseInt(row.count) || 0 : 0
			})
			res.send(metrics)
		}).catch(err => {
			console.log("err", err)
			res.status(500).send({ error: true })
		})
	}
}

const queryForMetric = (camera, metric) => {
	return pool.query(`SELECT ${metric == "count" ? "COUNT(*)" : "SUM(size)"} FROM frame_files WHERE camera=$1;`, [camera])
}

const queryToDeleteAndRecord = (camera, deleting, before="") => {
	const now = moment.utc().format("YYYY-MM-DD HH:mm:ss")
	if (deleting == "files") {
		return bulkPool.query(
			"WITH deleted AS (DELETE FROM frame_files WHERE camera=$1 AND timestamp<=($2::timestamp AT TIME ZONE 'UTC') RETURNING name, size), inserted AS (INSERT INTO frame_deletes(timestamp, camera, size, count) SELECT ($3::timestamp AT TIME ZONE 'UTC'), $1, COALESCE(SUM(size), 0), COUNT(*) FROM deleted) SELECT name FROM deleted;",
			[camera, before, now]
		)
	}
	return bulkPool.query(
		"WITH deleted AS (DELETE FROM frame_files WHERE camera=$1 RETURNING name, size), inserted AS (INSERT INTO frame_deletes(timestamp, camera, size, count) SELECT ($2::timestamp AT TIME ZONE 'UTC'), $1, COALESCE(SUM(size), 0), COUNT(*) FROM deleted) SELECT name FROM deleted;",
		[camera, now]
	)
}

const escapeIdent = (name) => name.replace(/"/g, "\"\"")

const queryForDailyStats = (cameras) => {
	const cols = cameras.map(({ id, name }) => `SUM(CASE WHEN camera=${id} THEN size ELSE 0 END) as "${escapeIdent(name)}"`)
	return pool.query(`SELECT date_trunc('minute', timestamp) as timestamp,${cols.join(",")} FROM frame_files WHERE timestamp >= NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 1 ASC;`)
}

const queryForGroupedStats = (cameras) => {
	const arrayOfColumns = cameras.map(({ id, name }) => `SUM(CASE WHEN camera=${id} THEN size ELSE 0 END) as "${escapeIdent(name)}"`)
	return bulkPool.query(`SELECT date_trunc('hour', timestamp) as timestamp,${arrayOfColumns.join(",")} FROM frame_files GROUP BY 1 ORDER BY 1 ASC;`)
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