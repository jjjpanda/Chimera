var archiver   = require("archiver")
var dateFormat = require("./dateFormat.js")
var fs         = require("fs")
var path       = require("path")
const {
	generateID,
	filterList,
	fileName,
	memoryEmitter,
}              = require("./converter.js")
const { EXPORT_LOCK_REFRESH_MS, exportLockName } = require("./file.js")
const {webhookAlert, alertTime, gatewayHost} = require("lib")

const emitToMemory = memoryEmitter("ZIP PROCESS")

const imgDir = path.join(process.env.storage_FOLDERPATH, "shared/captures")

const createZipList = (camera, start, end, skip, callback) => {
	var archive = archiver("zip", {
		zlib: {level: 9}
	})

	const rand = generateID()

	fs.writeFile(path.join(imgDir, exportLockName("zip", camera, rand)), "progress", () => {
		filterList(camera, start, end, skip, (filteredList) => {
			const frames = filteredList.length

			console.log(start.split("-")[0], start.split("-")[1], end.split("-")[0], end.split("-")[1])

			for (const file of filteredList){
				archive.file(path.join(imgDir, camera, file), {
					name: file
				})
			}

			callback(null, {frames, archive, rand})
		})
	})
}

const zip = (archive, camera, frames, start, end, rand, save, req, res) => {

	const txtPath = path.join(imgDir, exportLockName("zip", camera, rand))

	if(frames == 0){
		webhookAlert(`Zip Process:\nID: ${rand}\nCamera: ${camera}\nNot started: has ${frames} frames`)
		fs.unlink(txtPath, () => {})
		res.send({ id: rand, url: undefined })
	}
	else{
		const refreshLock = setInterval(() => {
			fs.utimes(txtPath, new Date(), new Date(), () => {})
		}, EXPORT_LOCK_REFRESH_MS)
		refreshLock.unref()

		if(save){
			const zipPath = path.join(imgDir, fileName(camera, start, end, rand, "zip"))
			var output = fs.createWriteStream(zipPath)
			let cancelled = false
			let alerted = false
			const alertFailure = () => {
				if(alerted) return
				alerted = true
				webhookAlert(`Your zip (${rand}) could not be completed.`)
			}

			output.on("error", (err) => {
				clearInterval(refreshLock)
				cancelled = true
				console.log("ZIP OUTPUT ERROR: " + err.message)
				emitToMemory("deleteProcessEnder", rand)
				fs.unlink(txtPath, () => {})
				fs.unlink(zipPath, () => {})
				alertFailure()
			})

			console.log("SENDING START ALERT")
			webhookAlert(`ZIP Started:\nID: ${rand}\nCamera: ${camera}\nFrames: ${frames}\nStart: ${alertTime(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a z")}\nEnd: ${alertTime(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a z")}`)

			output.on("close", () => {
				clearInterval(refreshLock)
				emitToMemory("deleteProcessEnder", rand)
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

			archive.on("error", function(err) {
				clearInterval(refreshLock)
				console.log("An error occurred: " + err.message)
				emitToMemory("deleteProcessEnder", rand)
				fs.unlink(txtPath, () => {
					if(!cancelled){
						alertFailure()
					}
					fs.unlink(zipPath, () => {})
				})
			})

			archive.pipe(output)

			emitToMemory("saveProcessEnder", rand, (cancel) => {
				if(!cancel) return
				cancelled = true
				clearInterval(refreshLock)
				archive.abort()
			})

			res.send({
				id: rand,
				frameLimitMet: req.body.frameLimitMet,
				url: `/shared/captures/${fileName(camera, start, end, rand, "zip")}`
			})
		}
		else{
			archive.on("error", function(err) {
				clearInterval(refreshLock)
				console.log("An error occurred: " + err.message)
				fs.unlink(txtPath, () => {})
				if(!res.headersSent) return res.status(500).end()
				res.destroy(err)
			})
			res.on("close", () => {
				clearInterval(refreshLock)
				fs.unlink(txtPath, () => {})
			})
			res.attachment(fileName(camera, start, end, rand, "zip"))
			archive.pipe(res, {end: true})
		}

		archive.finalize()
	}

}

module.exports = {
	zip,
	createZip: (req, res) => {
		let { camera, start, end, save, skip } = req.body

		skip = skip == undefined ? 1 : skip

		createZipList(camera, start, end, skip, (err, {frames, archive, rand}) => {
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
		
				zip(archive, camera, frames, start, end, rand, save, req, res)
			}
			else{
				res.send({error: true})
			}
		})
	}
}