require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var ffmpeg     = require('fluent-ffmpeg');
const slash    = require('./slash.js')

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)
  
const createFileList = (camera, frames) => {
    const dirList = fs.readdirSync(path.resolve(process.env.imgDir, camera))
    let total = 0

    let files = ""
    if(frames != "inf"){
        for (const file of dirList.filter(file => file.includes(".jpg")).slice(-1 * frames)){
            files += `file '${camera}/${file}'\r\n` 
            total++
        }
    }
    else{
        for (const file of dirList.filter(file => file.includes(".jpg"))){
            files += `file '${camera}/${file}'\r\n` 
            total++
        }
    }

    fs.writeFileSync(path.resolve(process.env.imgDir, `img_${camera}.txt`), files)
    return total
}

const convert = (camera, fps, total, save, res) => {

    if( !(save && save == "true") ) {
        res.attachment('output.mp4')
    }

    let videoCreator = ffmpeg(process.env.imgDir+`/img_${camera}.txt`)
        .inputFormat('concat') //ffmpeg(slash(path.join(process.env.imgDir,"img.txt"))).inputFormat('concat');
        .outputFPS(fps)
        .videoBitrate(1024)
        .videoCodec('libx264')
        .toFormat('mp4')
        .on('error', function(err) {
            console.log('An error occurred: ' + err.message);
        })
        .on('progress', function(progress) {
            console.log('Processing: ' + progress.percent + '% done');
            if(save && save == "true"){
                res.write(JSON.stringify({
                    progress: progress.frames/total,
                    url: `http://${process.env.host}:${process.env.PORT}/shared/captures/output_${camera}.mp4`
                }))
            }
        })
        .on('end', function() {
            console.log('Finished processing');
            if(save && save == "true"){
                res.send(JSON.stringify({
                    progress: 100,
                    url: `http://${process.env.host}:${process.env.PORT}/shared/captures/output_${camera}.mp4`
                }))
            }
            fs.unlinkSync(path.resolve(process.env.imgDir, `img_${camera}.txt`))
        })

    const createVideo = (creator) => {
        if(save && save == "true"){
            creator
                .mergeToFile(`${process.env.imgDir}/output_${camera}.mp4`, process.env.imgDir+'/') //.mergeToFile('output.mp4', path.relative(__dirname, path.resolve(process.env.imgDir)))
        }
        else{
            creator
                .outputOptions('-movflags frag_keyframe+empty_moov')
                .pipe(res, {end: true}) 
        }
    }

    createVideo(videoCreator)

}

module.exports = (req, res) => {
    //console.log(req)
    const { camera, frames, save, fps } = req.body;
    const total = createFileList(camera, frames)
    convert(camera, fps, total, save, res)
}