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

const convert = (camera, fps, save, res) => {

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
        })
        .on('end', function() {
            console.log('Finished processing');
            fs.unlinkSync(path.resolve(process.env.imgDir, `img_${camera}.txt`))
        })

    const createVideo = (creator) => {
        if(save && save == "true"){
            creator
                .mergeToFile(`${process.env.imgDir}/output_${camera}.mp4`, process.env.imgDir+'/') //.mergeToFile('output.mp4', path.relative(__dirname, path.resolve(process.env.imgDir)))
            
            res.send(JSON.stringify({
                url: `http://${process.env.host}:${process.env.PORT}/shared/captures/output_${camera}.mp4`
            }))
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
    createFileList(camera, frames)
    convert(camera, fps, save, res)
}