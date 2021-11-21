var fs         = require("fs")
var path       = require("path")
var moment     = require("moment")
var dateFormat = require("./dateFormat.js")
var {randomID}    = require("lib")

const imgDir = path.join(process.env.storage_FILEPATH, "shared/captures")

module.exports = {   
	generateID: () => {
		return randomID.generate() + "-" + moment().format(dateFormat)
	},
    
	filterList: (camera, start, end, skipEvery=1, callback) => {
		try {
			fs.readdir(path.join(imgDir, camera), (err, files) => {
				if(err){
					callback([])
				}
				else{
					let list = files.filter( file => file.includes(".jpg") && 
						`${file.split("-")[0]}-${file.split("-")[1]}` > start && 
						`${file.split("-")[0]}-${file.split("-")[1]}` <= end )
					callback(skipEvery == 1 ? list : list.filter( (file, index) => {
						return (index % skipEvery === 0 )
					}))
				}
			})
		} catch(e) {
			callback( [] )
		}
	},

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
		console.log(fileName)
		return {
			link: `${process.env.gateway_HOST}/shared/captures/${fileName}`,
			type: fileInfo[4].split(".")[1],
			id: fileInfo[4].split(".")[0],
			camera: fileInfo[1],
			start: fileInfo[2],
			end: fileInfo[3]
		}
	},

	findFile: (id, callback) => {
		fs.readdir(path.join(imgDir), (err, files) => {
			if(err){
				callback("output_0_start_end_id.type")
			}
			else{
				callback(files.find(file => file.includes(id) && !file.includes(".txt")))
			}
		})
	},

	validateRequest: (req, res, next) => {
		let { camera, start, end } = req.body

		start = (start == undefined ? moment().subtract(1, "week") : moment(start, dateFormat)).format(dateFormat)

		end = (end == undefined ? moment() : moment(end, dateFormat)).format(dateFormat)
        
		if(camera == undefined){
			res.status(400).send({
				error: "No Camera"
			})
		}
		else{
			camera = camera.toString()
			next()
		}
	},

	validateID: (req, res, next) => {
		const { id } = req.body
        
		if(id == undefined){
			res.status(400).send({
				error: "No ID"
			})
		}
		else{
			next()
		}
	},
}