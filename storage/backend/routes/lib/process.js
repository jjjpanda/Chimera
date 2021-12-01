var fs         = require("fs")
var path       = require("path")
const {
	filterType,
	parseFileName,
	findFile
}              = require("./converter.js")
const {webhookAlert} = require("lib")

const client = require("memory").client("PROCESS")

const imgDir = path.join(process.env.storage_FOLDERPATH, "shared/captures")

module.exports = {
	statusProcess: (req, res) => {
		const { id } = req.body

		findFile(id, (fileName) => {
			const { type } = parseFileName(fileName)

			console.log(id)
			fs.stat(path.join(imgDir, `${type}_${id}.txt`), (err) => {
				res.send({
					running: !err,
					id
				})
			})
		})
	},

	cancelProcess: (req, res) => {
		const { id } = req.body

		findFile(id, (fileName) => {
			const { type } = parseFileName(fileName)

			let cancelled = true
	
			client.emit("cancelProcess", id, type, (msg) => {
				if(msg == undefined || msg === "not cancelled"){
					cancelled = false
				}
				else{
					webhookAlert(msg)
				}
			})
	
			res.send({
				cancelled,
				id
			})
		})
	},
   
	listProcess: (req, res) => {
		Promise.all(["mp4", "zip"].map(type => {
			return new Promise(resolve => {
				filterType(type, (fileList) => {
					resolve(fileList)
				})
			})
		})).then(listOfFileLists => {
			let list = [].concat.apply([], listOfFileLists)

			Promise.all(list.map(file => {
				const { id, type } = parseFileName(file)
				return new Promise((resolve) => fs.stat(path.join(imgDir, `${type}_${id}.txt`), (err) => {
						resolve({
							...parseFileName(file),
							running: !err
						})
				}))
			})).then((asyncCompiledList) => {
				res.send({
					list: asyncCompiledList
				})
			}).catch(() => {
				res.send({
					error: true
				})
			})
		}).catch(() => {
			res.send({
				error: true
			})
		})
	},

	deleteProcess: (req, res) => {
		const { id } = req.body

		findFile(id, file => {
			console.log("TRYING TO DELETE", id)
			fs.unlink(path.join(imgDir, file), (err) => {
				res.send({
					deleted: !err,
					id
				})
			})
		})
	}
}