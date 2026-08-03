var fs         = require("fs")
var path       = require("path")
var moment     = require("moment")
var dateFormat = require("./dateFormat.js")
var {randomID, gatewayHost}    = require("lib")
var memory     = require("memory")
var {pool}     = require("../../lib/pool.js")

const imgDir = path.join(process.env.storage_FOLDERPATH, "shared/captures")

const FRAME_LIST_MAX = 250000

const FRAME_WINDOW = "FROM frame_files WHERE camera = $1 AND timestamp >= ($2::timestamp AT TIME ZONE 'UTC') AND timestamp < (($3::timestamp AT TIME ZONE 'UTC') + INTERVAL '1 second')"

const windowBound = (value) => moment.utc(value, dateFormat).format("YYYY-MM-DD HH:mm:ss")

const positiveInt = (value) => Math.max(parseInt(value) || 1, 1)

const frameNames = (query, params, callback) => pool.query(query, params)
	.then(({rows}) => callback(rows.map(row => row.name)))
	.catch((err) => {
		console.log("STORAGE FRAME LIST ERROR", err.message)
		callback([])
	})

module.exports = {
	generateID: () => {
		return randomID.generate() + "-" + moment.utc().format(dateFormat)
	},

	/** Emits only while `memory_ON` and connected, so ender packets and their acks never buffer during a memory outage; the 24h orphan sweep reconciles drops. */
	memoryEmitter: (label) => {
		const client = memory.client(label)
		return (event, ...args) => { if(process.env.memory_ON == "true" && client.connected) client.emit(event, ...args) }
	},
    
	/** Every `skipEvery`-th frame of the window, oldest first, for the ffmpeg concat manifest and zip archives. */
	filterList: (camera, start, end, skipEvery=1, callback) => frameNames(
		`SELECT name FROM (SELECT name, row_number() OVER (ORDER BY timestamp ASC, name ASC) - 1 AS idx ${FRAME_WINDOW}) frames WHERE idx % $4 = 0 ORDER BY idx ASC LIMIT $5`,
		[camera, windowBound(start), windowBound(end), positiveInt(skipEvery), FRAME_LIST_MAX],
		callback
	),

	/** At most `limit` frames of the window, evenly spaced across it, oldest first. */
	sampleList: (camera, start, end, limit, callback) => frameNames(
		`SELECT name FROM (SELECT name, row_number() OVER (ORDER BY timestamp ASC, name ASC) - 1 AS idx, COUNT(*) OVER () AS total ${FRAME_WINDOW}) frames WHERE idx % GREATEST(CEIL(total::numeric / $4), 1) = 0 ORDER BY idx ASC LIMIT $5`,
		[camera, windowBound(start), windowBound(end), positiveInt(limit), positiveInt(limit)],
		callback
	),

	filterType: (type, callback) => {
		fs.readdir(path.join(imgDir), (err, files) => {
			if(err){
				callback([])
			}
			else{
				callback(files.filter(file => file.includes(`.${type}`)))
			}
		})
	},

	fileName: (camera, start, end, id, type) => {
		return `output_${camera}_${start}_${end}_${id}.${type}`
	},

	parseFileName: (fileName) => {
		const fileInfo = fileName.split("_")
		if (fileInfo.length < 5) return { error: true }
		const id = fileInfo[4].split(".")[0]
		return {
			link: `${gatewayHost()}/shared/captures/${fileName}`,
			type: fileInfo[4].split(".")[1],
			id,
			requested: `${id.split("-")[1]}-${id.split("-")[2]}`,
			camera: fileInfo[1],
			start: fileInfo[2],
			end: fileInfo[3]
		}
	},

	findFile: (id, callback) => {
		const defaultName = "output_0_start_end_id.type"
		fs.readdir(path.join(imgDir), (err, files) => {
			if(err){
				callback(defaultName)
			}
			else{
				const file = files.find(file => {
					if(file.includes(".txt")) return false
					const parts = file.split("_")
					return parts.length >= 5 && parts[4].split(".")[0] === id
				})
				callback(file ? file : defaultName)
			}
		})
	},

	validateDays: (req, res, next) => {
		const { days, hours } = req.body
		if (hours != undefined) {
			req.body.start = moment.utc().subtract(hours, "hours").format(dateFormat)
			req.body.end = moment.utc().format(dateFormat)
		} else if (days != undefined) {
			req.body.start = moment.utc().subtract(days, "days").format(dateFormat)
			req.body.end = moment.utc().format(dateFormat)
		}
		next()
	},

	validateRequest: (req, res, next) => {
		let { camera, start, end } = req.body

		start = (start == undefined ? moment.utc().subtract(1, "week") : moment.utc(start, dateFormat)).format(dateFormat)

		end = (end == undefined ? moment.utc() : moment.utc(end, dateFormat)).format(dateFormat)

		req.body.start = start
		req.body.end = end

		if(camera == undefined){
			res.status(400).send({
				error: true,
				msg: "no camera"
			})
		}
		else if(!/^\d+$/.test(camera.toString())){
			res.status(400).send({
				error: true,
				msg: "invalid camera"
			})
		}
		else{
			req.body.camera = String(parseInt(camera))
			next()
		}
	},

	validateID: (req, res, next) => {
		const { id } = req.body

		if(typeof id !== "string" || id.includes("..") || !/^[A-Za-z0-9._()-]+$/.test(id)){
			res.status(400).send({
				error: true,
				msg: "no id"
			})
		}
		else{
			next()
		}
	},
}