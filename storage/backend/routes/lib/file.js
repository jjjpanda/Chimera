const path = require("path")
const fs = require("fs")
const moment = require("moment")
const { loadCameras, webhookAlert, mapLimit, schedulableUrls } = require("lib")

const { pool, bulkPool } = require("../../lib/pool")
const { FS_CONCURRENCY, CAPTURES_DIR, OBJECT_CAPTURES_DIR, dirFileBytes } = require("../../lib/fsUsage")

const MAX_STUCK_BATCHES = 3

const STATS_WINDOW_DAYS = 32

const EXPORT_LOCK_ACTIVE_MS = 5 * 60 * 1000

const EXPORT_LOCK_REFRESH_MS = EXPORT_LOCK_ACTIVE_MS / 3

const UNLINK_BATCH = 500

const camerasOrFail = (res) => loadCameras().catch(() => {
	res.status(500).send({ error: true })
	return null
})

const EXPORT_LOCK_PATTERN = /^(mp4|zip)_(?:(\d+)_)?(.+)\.txt$/

const exportLockName = (type, camera, id) => `${type}_${camera}_${id}.txt`

const exportingCameras = async () => {
	const entries = await fs.promises.readdir(CAPTURES_DIR).catch(() => [])
	const cutoff = Date.now() - EXPORT_LOCK_ACTIVE_MS
	const cameras = await mapLimit(entries, FS_CONCURRENCY, async (f) => {
		const match = EXPORT_LOCK_PATTERN.exec(f)
		if (!match) return null
		const fresh = await fs.promises.stat(path.join(CAPTURES_DIR, f)).then(s => s.mtimeMs > cutoff).catch(() => false)
		return fresh ? match[2] : null
	})
	return new Set(cameras.filter(Boolean))
}

const exportInProgress = async (camera) => {
	const cameras = await exportingCameras()
	return camera == null ? cameras.size > 0 : cameras.has(String(camera))
}

const MAX_CONSECUTIVE_DEFERRALS = 6

const DEFERRAL_STATE_PATH = path.join(CAPTURES_DIR, "prune_deferrals.json")

const DEFERRAL_LOCK_PATH = `${DEFERRAL_STATE_PATH}.lock`

const DEFERRAL_LOCK_RETRY_MS = 25

const DEFERRAL_LOCK_STALE_MS = 10000

const DEFERRAL_LOCK_TIMEOUT_MS = DEFERRAL_LOCK_STALE_MS * 3

const acquireDeferralLock = async () => {
	const deadline = Date.now() + DEFERRAL_LOCK_TIMEOUT_MS
	do {
		try {
			fs.closeSync(fs.openSync(DEFERRAL_LOCK_PATH, "wx"))
			return
		} catch (e) {
			if (e.code !== "EEXIST") throw e
			let stat
			try { stat = fs.statSync(DEFERRAL_LOCK_PATH) } catch { stat = null }
			if (stat && Date.now() - stat.mtimeMs > DEFERRAL_LOCK_STALE_MS) {
				try { fs.unlinkSync(DEFERRAL_LOCK_PATH) } catch { /* raced another releaser */ }
			}
			await new Promise((r) => setTimeout(r, DEFERRAL_LOCK_RETRY_MS))
		}
	} while (Date.now() < deadline)
	throw new Error(`deferral lock ${DEFERRAL_LOCK_PATH} unavailable after ${DEFERRAL_LOCK_TIMEOUT_MS}ms`)
}

const releaseDeferralLock = () => {
	try { fs.unlinkSync(DEFERRAL_LOCK_PATH) } catch { /* already released */ }
}

const applyDeferral = async (key, deferred) => {
	await acquireDeferralLock()
	try {
		const raw = await fs.promises.readFile(DEFERRAL_STATE_PATH, "utf8").catch(() => "{}")
		let state
		try { state = JSON.parse(raw) } catch { state = {} }
		if (!state || typeof state !== "object") state = {}

		const count = deferred ? (parseInt(state[key]) || 0) + 1 : 0
		if (count === (parseInt(state[key]) || 0)) return
		if (count) state[key] = count
		else delete state[key]
		await fs.promises.writeFile(DEFERRAL_STATE_PATH, JSON.stringify(state)).catch(() => {})

		if (count >= MAX_CONSECUTIVE_DEFERRALS && count % MAX_CONSECUTIVE_DEFERRALS === 0) {
			const capNote = key.split(":")[0] === "/file/pathAutoClean" ? " Cap enforcement is stalled and disk may grow past storage_MAX_GB." : ""
			webhookAlert(`⚠️ Storage prune ${key} has deferred ${count} runs in a row behind live exports.${capNote} Check for frequent or long-running exports.`, "admin")
		}
	} finally {
		releaseDeferralLock()
	}
}

let deferralChain = Promise.resolve()

const settleDeferral = (req, deferred) => {
	const route = `${req.baseUrl}${req.path}`
	if (!schedulableUrls.includes(route)) return Promise.resolve()

	const camera = req.body?.camera ?? req.params?.id
	const key = camera == null ? route : `${route}:${camera}`

	const run = deferralChain.then(() => applyDeferral(key, deferred)).catch((e) => console.log("STORAGE DEFERRAL STATE ERROR", key, e.message))
	deferralChain = run
	return run
}

const clearedTotals = (rows) => ({ count: rows.length, size: rows.reduce((sum, r) => sum + (parseInt(r.size) || 0), 0) })

const clearRowsFor = (camera, names) =>
	names.length === 0
		? Promise.resolve({ count: 0, size: 0 })
		: bulkPool.query("DELETE FROM frame_files WHERE camera = $1 AND name = ANY($2::varchar[]) RETURNING size", [camera, names]).then((r) => clearedTotals(r.rows)).catch(() => null)

const clearCameraRows = (camera) =>
	bulkPool.query("DELETE FROM frame_files WHERE camera=$1 RETURNING size", [camera]).then((r) => clearedTotals(r.rows)).catch(() => null)

const removeCameraDirectory = async (camera, dir) => {
	const entries = await fs.promises.readdir(dir).catch(() => [])

	for (let i = 0; i < entries.length; i += UNLINK_BATCH) {
		if (await exportInProgress(camera)) return { deferred: true, removed: i }
		const batch = entries.slice(i, i + UNLINK_BATCH)
		await mapLimit(batch, FS_CONCURRENCY, (f) =>
			fs.promises.unlink(path.join(dir, f)).catch(() => {})
		)
	}

	await fs.promises.rm(dir, { recursive: true, force: true })
	return { deferred: false, removed: entries.length }
}

const FRAME_SWEEP_GRACE_MS = 15 * 60 * 1000

const NAME_LOOKUP_BATCH = 500

let sweepInProgress = false

const sweepOrphanFrames = async () => {
	if (sweepInProgress) {
		console.log("STORAGE FRAME SWEEP SKIPPED — previous sweep still in progress")
		return 0
	}
	sweepInProgress = true
	try {
		return await sweepOrphanFramesOnce()
	} finally {
		sweepInProgress = false
	}
}

const sweepOrphanFramesOnce = async () => {
	const cutoff = Date.now() - FRAME_SWEEP_GRACE_MS
	const entries = await fs.promises.readdir(CAPTURES_DIR, { withFileTypes: true }).catch(() => [])
	const cameras = entries.filter(e => e.isDirectory() && /^\d+$/.test(e.name)).map(e => e.name)

	let backfilled = 0

	for (const camera of cameras) {
		const dir = path.join(CAPTURES_DIR, camera)
		const files = (await fs.promises.readdir(dir).catch(() => [])).filter(f => {
			if (!f.endsWith(".jpg")) return false
			const captured = moment.utc(f.slice(0, 15), "YYYYMMDD-HHmmss", true)
			return !captured.isValid() || captured.valueOf() < cutoff
		})

		for (let i = 0; i < files.length; i += NAME_LOOKUP_BATCH) {
			const chunk = files.slice(i, i + NAME_LOOKUP_BATCH)
			const { rows } = await bulkPool.query(
				"SELECT name FROM frame_files WHERE camera = $1 AND name = ANY($2::varchar[])",
				[camera, chunk]
			)
			const tracked = new Set(rows.map(r => r.name))
			const orphans = chunk.filter(f => !tracked.has(f))
			if (orphans.length === 0) continue

			const recovered = (await mapLimit(orphans, FS_CONCURRENCY, async (f) => {
				const stats = await fs.promises.stat(path.join(dir, f)).catch(() => null)
				if (!stats || stats.mtimeMs > cutoff) return null
				const captured = moment.utc(f.slice(0, 15), "YYYYMMDD-HHmmss", true)
				return { name: f, size: stats.size, timestamp: (captured.isValid() ? captured : moment.utc(stats.mtimeMs)).toISOString() }
			})).filter(Boolean)
			if (recovered.length === 0) continue

			await bulkPool.query(
				"INSERT INTO frame_files(timestamp, camera, name, size) SELECT * FROM UNNEST($1::timestamptz[], $2::numeric[], $3::varchar[], $4::numeric[]) ON CONFLICT (camera, name) DO NOTHING",
				[recovered.map(r => r.timestamp), recovered.map(() => camera), recovered.map(r => r.name), recovered.map(r => r.size)]
			)
			backfilled += recovered.length
		}
	}

	if (backfilled) console.log(`STORAGE FRAME SWEEP backfilled ${backfilled} untracked frame file(s) into frame_files`)
	return backfilled
}

module.exports = {
	EXPORT_LOCK_ACTIVE_MS,
	EXPORT_LOCK_REFRESH_MS,
	EXPORT_LOCK_PATTERN,
	MAX_CONSECUTIVE_DEFERRALS,
	DEFERRAL_STATE_PATH,
	DEFERRAL_LOCK_RETRY_MS,
	FRAME_SWEEP_GRACE_MS,
	exportLockName,
	exportingCameras,
	settleDeferral,
	removeCameraDirectory,
	sweepOrphanFrames,

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

	selectFilesBeforeDate: (req, res, next) => {
		const { camera, days } = req.body
		const beforeDate = moment.utc().subtract(days, "days").format("YYYY-MM-DD HH:mm:ss")
		bulkPool.query("SELECT name FROM frame_files WHERE camera=$1 AND timestamp<=($2::timestamp AT TIME ZONE 'UTC')", [camera, beforeDate]).then(({ rows }) => {
			req.deletedFileNames = rows.map(row => row.name)
			req.beforeDate = beforeDate
			next()
		}).catch(err => {
			console.log(err)
			res.status(500).send({ error: true })
		})
	},

	deleteFileDirectory: async (req, res) => {
		let outcome
		try {
			outcome = await removeCameraDirectory(req.body.camera, req.body.appendedPath)
		} catch {
			return res.status(500).send({ error: true })
		}
		const { deferred } = outcome
		if (deferred) console.log(`STORAGE DIRECTORY DELETE DEFERRED mid-run for camera ${req.body.camera}; a fresh export lock appeared after ${outcome.removed} file(s), the rest will be swept on the next clean`)
		const cleared = deferred ? { count: 0, size: 0 } : await clearCameraRows(req.body.camera)
		if (!cleared) return res.status(500).send({ error: true })
		await recordDeletions(req.body.camera, cleared)
		await settleDeferral(req, deferred)
		res.send({ deleted: cleared.count > 0, ...(deferred && { deferred: true }) })
	},

	deleteFilesBeforeDateGlob: async (req, res) => {
		const dir = req.body.appendedPath
		const names = (req.deletedFileNames || []).filter(Boolean)
		const tracked = []
		const totals = { count: 0, size: 0 }
		let deferred = false
		let clearFailed = false

		for (let i = 0; i < names.length; i += UNLINK_BATCH) {
			if (await exportInProgress(req.body.camera)) {
				deferred = true
				break
			}
			const batch = names.slice(i, i + UNLINK_BATCH).map(name => path.basename(name))
			const results = await mapLimit(batch, FS_CONCURRENCY, name =>
				fs.promises.unlink(path.join(dir, name)).then(() => true).catch((e) => e.code === "ENOENT")
			)
			tracked.push(...results)
			const cleared = await clearRowsFor(req.body.camera, batch.filter((f, idx) => results[idx]))
			if (!cleared) {
				clearFailed = true
				break
			}
			totals.count += cleared.count
			totals.size += cleared.size
		}

		if (req.beforeDate && !deferred && !clearFailed) {
			const cutoff = moment.utc(req.beforeDate).valueOf()
			const known = new Set(names.map(n => path.basename(n)))
			const entries = await fs.promises.readdir(dir).catch(() => [])
			const stale = entries.filter(f => f.endsWith(".jpg") && !known.has(f))

			for (let i = 0; i < stale.length; i += UNLINK_BATCH) {
				if (await exportInProgress(req.body.camera)) {
					deferred = true
					break
				}
				const staleBatch = stale.slice(i, i + UNLINK_BATCH)
				const removedStale = (await mapLimit(staleBatch, FS_CONCURRENCY, async (f) => {
					const captured = moment.utc(f.slice(0, 15), "YYYYMMDD-HHmmss", true)
					if (captured.isValid() && captured.valueOf() < cutoff) {
						return fs.promises.unlink(path.join(dir, f)).then(() => f).catch((e) => e.code === "ENOENT" ? f : null)
					}
					return null
				})).filter(Boolean)
				const cleared = await clearRowsFor(req.body.camera, removedStale)
				if (!cleared) {
					clearFailed = true
					break
				}
				totals.count += cleared.count
				totals.size += cleared.size
			}
		}

		const failed = tracked.filter(ok => !ok).length
		if (failed) console.log(`STORAGE FILE UNLINK FAILED for ${failed} file(s); their rows were left intact for the next clean`)
		if (deferred) console.log(`STORAGE CLEAN DEFERRED mid-run for camera ${req.body.camera}; a fresh export lock appeared, ${names.length - tracked.length} file(s) left for the next clean`)
		await recordDeletions(req.body.camera, totals)
		await settleDeferral(req, deferred)
		if (clearFailed) return res.status(500).send({ error: true })
		res.send({ deleted: totals.count > 0 && failed === 0 && tracked.length === names.length, ...(deferred && { deferred: true }) })
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

	deferIfExporting: async (req, res, next) => {
		if (await exportInProgress(req.body?.camera ?? req.params?.id)) {
			await settleDeferral(req, true)
			return res.send({ deferred: true })
		}
		next()
	},

	autoClean: async (req, res) => {
		const sendSettled = async (body) => {
			await settleDeferral(req, false)
			return res.send(body)
		}
		try {
			const maxGb = parseFloat(process.env.storage_MAX_GB) || 0
			if (!maxGb) return sendSettled({ skipped: true })

			const { rows: frameTotalRows } = await bulkPool.query(
				"SELECT COALESCE(SUM(size), 0) AS total FROM frame_files WHERE size IS NOT NULL AND size > 0"
			)
			const frameTotal = parseInt(frameTotalRows[0].total) || 0

			const nonFrameBytes = await dirFileBytes(CAPTURES_DIR)
			const usedObjectBytes = await dirFileBytes(OBJECT_CAPTURES_DIR)
			const totalUsedBytes = frameTotal + nonFrameBytes + usedObjectBytes

			const targetBytes = maxGb * 0.9 * 1e9
			if (totalUsedBytes <= targetBytes) return sendSettled({ cleaned: false })

			const toFree = totalUsedBytes - targetBytes
			if (toFree >= frameTotal) {
				webhookAlert(`⚠️ Storage over ${maxGb}GB cap but non-frame artifacts (videos/zips) dominate — deleting all frames would not reach target, so auto-clean was skipped.`, "admin")
				return sendSettled({ cleaned: false })
			}

			let freed = 0
			let deleted = 0
			const stuck = []
			let stuckBatches = 0
			let page = []
			let cursor = 0
			let deferred = false

			while (freed < toFree) {
				const locked = await exportingCameras()

				if (cursor >= page.length) {
					const { rows } = await bulkPool.query(
						"SELECT id, camera, name, size FROM frame_files WHERE size IS NOT NULL AND size > 0 AND NOT (id = ANY($1::int[])) AND NOT (camera = ANY($2::int[])) ORDER BY timestamp ASC LIMIT 10000",
						[stuck, [...locked].map(Number)]
					)
					if (rows.length === 0) {
						if (!deferred && locked.size > 0) {
							const { rows: lockedRows } = await bulkPool.query(
								"SELECT 1 FROM frame_files WHERE size IS NOT NULL AND size > 0 AND NOT (id = ANY($1::int[])) AND camera = ANY($2::int[]) LIMIT 1",
								[stuck, [...locked].map(Number)]
							)
							deferred = lockedRows.length > 0
						}
						break
					}
					page = rows
					cursor = 0
				}

				let planned = freed
				const batch = []
				while (cursor < page.length && planned < toFree && batch.length < UNLINK_BATCH) {
					const row = page[cursor++]
					if (locked.has(String(row.camera))) {
						deferred = true
						continue
					}
					batch.push(row)
					planned += parseInt(row.size) || 0
				}
				if (batch.length === 0) continue

				const removed = await mapLimit(batch, FS_CONCURRENCY, row =>
					fs.promises.unlink(path.join(CAPTURES_DIR, row.camera.toString(), path.basename(row.name)))
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

			deferred = deferred && freed < toFree

			if (stuck.length) {
				webhookAlert(`⚠️ Storage auto-clean could not unlink ${stuck.length} frame file(s); their rows were left intact. Check permissions on ${CAPTURES_DIR}.`, "admin")
			}
			if (deferred) console.log(`STORAGE AUTO-CLEAN DEFERRED mid-run after freeing ${freed} of ${toFree} bytes; a fresh export lock appeared`)
			await settleDeferral(req, deferred)
			if (deleted === 0) return res.send({ cleaned: false, ...(deferred && { deferred: true }) })
			res.send({ cleaned: true, deleted, ...(deferred && { deferred: true }) })
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

const recordDeletions = (camera, { count, size }) => {
	if (count === 0) return Promise.resolve()
	return bulkPool.query(
		"INSERT INTO frame_deletes(timestamp, camera, size, count) VALUES (($1::timestamp AT TIME ZONE 'UTC'), $2, $3, $4);",
		[moment.utc().format("YYYY-MM-DD HH:mm:ss"), camera, size, count]
	).catch((err) => console.log("STORAGE FRAME_DELETES AUDIT INSERT FAILED", camera, err.message))
}

const escapeIdent = (name) => name.replace(/"/g, "\"\"")

const queryForDailyStats = (cameras) => {
	const cols = cameras.map(({ id, name }) => `SUM(CASE WHEN camera=${id} THEN size ELSE 0 END) as "${escapeIdent(name)}"`)
	return pool.query(`SELECT date_trunc('minute', timestamp) as timestamp,${cols.join(",")} FROM frame_files WHERE timestamp >= NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 1 ASC;`)
}

const queryForGroupedStats = (cameras) => {
	const arrayOfColumns = cameras.map(({ id, name }) => `SUM(CASE WHEN camera=${id} THEN size ELSE 0 END) as "${escapeIdent(name)}"`)
	return pool.query(`SELECT date_trunc('hour', timestamp) as timestamp,${arrayOfColumns.join(",")} FROM frame_files WHERE timestamp >= NOW() - INTERVAL '${STATS_WINDOW_DAYS} days' GROUP BY 1 ORDER BY 1 ASC;`)
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