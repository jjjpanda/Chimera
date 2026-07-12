var archiver   = require("archiver")
var dateFormat = require("./dateFormat.js")
var fs         = require("fs")
var path       = require("path")
const {
	generateID,
	filterList,
	fileName,
}              = require("./converter.js")
const {webhookAlert, alertTime, gatewayHost} = require("lib")

const client = require("memory").client("ZIP PROCESS")

const imgDir = path.join(process.env.storage_FOLDERPATH, "shared/captures")

const createZipList = (camera, start, end, skip, callback) => {
	var archive = archiver("zip", {
		zlib: {level: 9}
	})

	filterList(camera, start, end, skip, (filteredList) => {
		const frames = filteredList.length    

		console.log(start.split("-")[0], start.split("-")[1], end.split("-")[0], end.split("-")[1])
		
		for (const file of filteredList){
			archive.file(path.join(imgDir, camera, file), {
				name: file
			}) 
		}
	
		callback(null, {frames, archive})
	})
}

const zip = (archive, camera, frames, start, end, save, req, res) => {

	const rand = generateID()

	if(frames == 0){
		webhookAlert(`Zip Process:\nID: ${rand}\nCamera: ${camera}\nNot started: has ${frames} frames`)
		res.send({ id: rand, url: undefined })
	}
	else{
		if(save){
			const zipPath = path.join(imgDir, fileName(camera, start, end, rand, "zip"))
			const txtPath = path.join(imgDir, `zip_${rand}.txt`)
			let cancelled = false
			let alerted = false
			const alertFailure = () => {
				if(alerted) return
				alerted = true
				webhookAlert(`Your zip (${rand}) could not be completed.`)
			}

			console.log("SENDING START ALERT")
			webhookAlert(`ZIP Started:\nID: ${rand}\nCamera: ${camera}\nFrames: ${frames}\nStart: ${alertTime(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a z")}\nEnd: ${alertTime(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a z")}`)

			archive.on("error", function(err) {
				console.log("An error occurred: " + err.message)
				fs.unlink(txtPath, () => {
					if(!cancelled){
						alertFailure()
					}
					fs.unlink(zipPath, () => {})
				})
			})

			fs.writeFile(txtPath, "progress", (err) => {
				if(err){
					console.log("ZIP LOCK WRITE ERROR: " + err.message)
					cancelled = true
					archive.abort()
					fs.unlink(txtPath, () => {})
					alertFailure()
					return res.send({error: true})
				}

				var output = fs.createWriteStream(zipPath)

				output.on("error", (err) => {
					cancelled = true
					console.log("ZIP OUTPUT ERROR: " + err.message)
					fs.unlink(txtPath, () => {})
					fs.unlink(zipPath, () => {})
					alertFailure()
				})

				output.on("close", () => {
					fs.unlink(txtPath, () => {
						if(cancelled){
							fs.unlink(zipPath, () => {})
						}
						else{
							console.log("SENDING END ALERT")
							webhookAlert(`Your zip archive (${rand}) is finished. Download it at: ${gatewayHost()}/shared/captures/${fileName(camera, start, end, rand, "zip")}`)
						}
					})
				})

				archive.pipe(output)

				client.emit("saveProcessEnder", rand, () => {
					cancelled = true
					archive.abort()
				})

				res.send({
					id: rand,
					frameLimitMet: req.body.frameLimitMet,
					url: `/shared/captures/${fileName(camera, start, end, rand, "zip")}`
				})

				archive.finalize()
			})
		}
		else{
			archive.on("error", function(err) {
				console.log("An error occurred: " + err.message)
				if(!res.headersSent) return res.status(500).end()
				res.destroy(err)
			})
			res.attachment(fileName(camera, start, end, rand, "zip"))
			archive.pipe(res, {end: true})
			archive.finalize()
		}
	}

}

module.exports = {
	zip,
	createZip: (req, res) => {
		let { camera, start, end, save, skip } = req.body

		skip = skip == undefined ? 1 : skip

		createZipList(camera, start, end, skip, (err, {frames, archive}) => {
			if(!err){
				if(save == undefined || save == true || save == "true"){
					save = true
				}
				else if(frames > 1000){
					save = true
					req.body.frameLimitMet = true
				}
				else{
					save = false
				}
		
				zip(archive, camera, frames, start, end, save, req, res)
			}
			else{
				res.send({error: true})
			}
		})
	}
}