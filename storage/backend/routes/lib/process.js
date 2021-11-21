var fs         = require("fs")
var path       = require("path")
const {
	filterType,
	parseFileName,
	findFile
}              = require("./converter.js")
const {webhookAlert} = require("lib")

const client = require("memory").client("PROCESS")

const imgDir = path.join(process.env.storage_FILEPATH, "shared/captures")

module.exports = {
	statusProcess: (req, res) => {
		const { id } = req.body

		const { type } = parseFileName(findFile(id))

		console.log(id)
		fs.stat(path.join(imgDir, `${type}_${id}.txt`), (err) => {
			res.send(JSON.stringify({
				running: !err,
				id
			}))
		})
	},

	cancelProcess: (req, res) => {
		const { id } = req.body

		const { type } = parseFileName(findFile(id))

		let cancelled = true

		client.emit("cancelProcess", id, type, (msg) => {
			if(msg == undefined || msg === "not cancelled"){
				cancelled = false
			}
			else{
				webhookAlert(msg)
			}
		})

		res.send(JSON.stringify({
			cancelled,
			id
		}))
	},
   
	listProcess: (req, res) => {
		let list = [...filterType("zip"), ...filterType("mp4")]

		list = list.map(file => {
			const { id, type } = parseFileName(file)

			return {
				...parseFileName(file),
				requested: id.split("-")[1]+"-"+id.split("-")[2],
				//sync
				running: fs.existsSync(path.join(imgDir, `${type}_${id}.txt`))
			}
		})

		res.send({
			list
		})
	},

	deleteProcess: (req, res) => {
		const { id } = req.body

		const file = findFile(id)

		console.log(id)
		fs.unlink(path.join(imgDir, file), (err) => {
			res.send(JSON.stringify({
				deleted: !err,
				id
			}))
		})
	}
}