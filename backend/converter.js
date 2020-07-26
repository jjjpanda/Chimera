require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var ffmpeg     = require('fluent-ffmpeg');
const slash    = require('./slash.js')

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)
  
const createFileList = (camera, frames) => {
    const dirList = fs.readdirSync(path.resolve(process.env.imgDir, camera))
 
    let files = ""
    if(frames != "inf"){
        for (const file of dirList.filter(file => file.includes(".jpg")).slice(-1 * frames)){
            files += `file '${camera}/${file}'\r\n` 
        }
    }
    else{
        for (const file of dirList.filter(file => file.includes(".jpg"))){
            files += `file '${camera}/${file}'\r\n` 
        }
    }

    fs.writeFileSync(path.resolve(process.env.imgDir, `img_${camera}.txt`), files)
}

const convert = (camera, fps, res) => {

    let videoCreator = ffmpeg(process.env.imgDir+`/img_${camera}.txt`).inputFormat('concat'); //ffmpeg(slash(path.join(process.env.imgDir,"img.txt"))).inputFormat('concat');
        
    const createVideo = (creator) => {
        creator
        .outputFPS(fps)
        .videoBitrate(1024)
        .videoCodec('libx264')
        .outputOptions('-movflags frag_keyframe+empty_moov')
        .toFormat('mp4')
        .on('error', function(err) {
            console.log('An error occurred: ' + err.message);
        })
        .on('progress', function(progress) {
            console.log('Processing: ' + progress.percent + '% done');
        })
        .on('end', function() {
            console.log('Finished processing');
            fs.unlinkSync(path.resolve(process.env.imgDir, `img_${camera}.txt`))
        })
        .pipe(res, {end: true})
        .mergeToFile(`${process.env.imgDir}/output_${camera}.mp4`, process.env.imgDir+'/') //.mergeToFile('output.mp4', path.relative(__dirname, path.resolve(process.env.imgDir)))
    }

    createVideo(videoCreator)

}

module.exports = (req, res) => {
    //console.log(req)
    const { camera, frames, fps } = req.body;
    createFileList(camera, frames)
    res.attachment('output.mp4')
    convert(camera, fps, res)
}