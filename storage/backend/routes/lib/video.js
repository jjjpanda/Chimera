var ffmpeg     = require("fluent-ffmpeg")
var fs         = require("fs")
var path       = require("path")
var dateFormat = require("./dateFormat.js")
const cliProgress = require("cli-progress")
const {
	generateID,
	filterList,
	fileName,
}              = require("./converter.js")
const {webhookAlert, alertTime, gatewayHost} = require("lib")

ffmpeg.setFfmpegPath(process.env.ffmpeg_FILEPATH)
ffmpeg.setFfprobePath(process.env.ffprobe_FILEPATH)

const client = require("memory").client("VIDEO PROCESS")

const imgDir = path.join(process.env.storage_FOLDERPATH, "shared/captures")

const createFrameList = (camera, start, end, limit, callback) => {
	filterList(camera, start, end, undefined, (filteredList) => {
		const limitIteration = Math.ceil(filteredList.length/limit)

		const limitedList = filteredList.filter((item, index) => {
			return (index % limitIteration === 0)
		}).map((item) => {
			return `/shared/captures/${camera}/${item}`
		})
	
		callback(limitedList)
	})
}

const createVideoList = (camera, start, end, skip, callback) => {
	const rand = generateID()

	filterList(camera, start, end, skip, (filteredList) => {
		const frames = filteredList.length    

		let files = ""
	
		console.log(start.split("-")[0], start.split("-")[1], end.split("-")[0], end.split("-")[1])
		
		for (const file of filteredList){
			files += `file '${camera}/${file}'\r\n` 
		}
		
		fs.writeFile(path.join(imgDir, `mp4_${rand}.txt`), files, (err) => {
			if(err){
				callback(err, undefined)
			}
			else{
				callback(false, { rand, frames })
			}
		})
	})
}

const clampFPS = (fps) => {
	fps = Number(fps)
	return Number.isFinite(fps) ? Math.min(Math.max(fps, 1), 60) : 20
}

const video = (camera, fps, frames, start, end, rand, save, req, res) => {

	if(frames == 0){
		webhookAlert(`Video Process:\nID: ${rand}\nCamera: ${camera}\nNot started: has ${frames} frames`)
		fs.unlink(path.join(imgDir, `mp4_${rand}.txt`), () => {})
		res.send({ id: rand, url: undefined })
	}
	else {
		if(save){
			console.log("SENDING START ALERT")
			webhookAlert(`Video Started:\nID: ${rand}\nCamera: ${camera}\nFrames: ${frames}\nStart: ${alertTime(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a z")}\nEnd: ${alertTime(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a z")}`)
		}
		else{
			res.attachment(fileName(camera, start, end, rand, "mp4"))
		}

		const bar = new cliProgress.SingleBar({
			format: `Video Generation ID: ${rand} [{bar}] {percentage}% | Time Elapsed: {duration}s`,
			noTTYOutput: true,
		}, cliProgress.Presets.shades_classic)

		const txtPath = path.join(imgDir, `mp4_${rand}.txt`)
		const mp4Path = path.join(imgDir, fileName(camera, start, end, rand, "mp4"))
		let cancelled = false

		let videoCreator = ffmpeg(imgDir+`/mp4_${rand}.txt`)
			.inputFormat("concat") //ffmpeg(slash(path.join(imgDir,"img.txt"))).inputFormat('concat');
			.outputFPS(fps)
			.videoBitrate(Math.pow(2, 14))
			.videoCodec("libx264")
			.toFormat("mp4")
			.on("progress", function(progress) {
				bar.update(Math.round((progress.frames/frames)*100))
			})
			.on("end", () => {
				bar.stop()
				client.emit("deleteProcessEnder", rand)
				fs.unlink(txtPath, () => {
					if(save){
						webhookAlert(`Your video (${rand}) is finished. Download it at: ${gatewayHost()}/shared/captures/${fileName(camera, start, end, rand, "mp4")}`)
					}
				})
			})

		videoCreator.on("error", function(err) {
			console.log("An error occurred: " + err.message)
			client.emit("deleteProcessEnder", rand)
			if(!save){
				if(!res.headersSent) res.status(500).end()
				else res.destroy(err)
			}
			fs.unlink(txtPath, () => {
				if(save && !cancelled){
					webhookAlert(`Your video (${rand}) could not be completed.`)
				}
				fs.unlink(mp4Path, () => {})
			})
		})

		client.emit("saveProcessEnder", rand, () => {
			cancelled = true
			videoCreator.kill()
		})

		const createVideo = (creator) => {
			if(save){
				creator
					.mergeToFile(`${imgDir}/${fileName(camera, start, end, rand, "mp4")}`, imgDir+"/") //.mergeToFile('output.mp4', path.relative(__dirname, path.join(imgDir)))
                
				bar.start(100, 0)
				res.send({
					id: rand,
					frameLimitMet: req.body.frameLimitMet,
					url: `/shared/captures/${fileName(camera, start, end, rand, "mp4")}`
				})
			}
			else{
				creator
					.outputOptions("-movflags frag_keyframe+empty_moov")
					.pipe(res, {end: true}) 
			}
		}

		createVideo(videoCreator)
	}

}

module.exports = {
	clampFPS,

	createVideo: (req, res) => {
		//console.log(req)
		let { camera, start, end, save, fps, skip } = req.body

		fps = clampFPS(fps)

		skip = skip == undefined ? 1 : skip

		console.log(camera, start, end, fps)
		createVideoList(camera, start, end, skip, (err, result) => {
			if(err){
				res.send({error: true})
			}
			else{
				const {rand, frames} = result
				if(save == undefined || save == true || save == "true"){
					save = true
				}
				else if(frames > 500){
					save = true
					req.body.frameLimitMet = true
				}
				else{
					save = false
				}
		
				video(camera, fps, frames, start, end, rand, save, req, res)
			}
		})
	},

	listOfFrames: (req, res) => {

		let { camera, start, end, frames } = req.body

		if(frames == undefined){
			frames = 10
		}

		createFrameList(camera, start, end, frames, (list) => {
			res.send({
				list
			})
		})
	}
}