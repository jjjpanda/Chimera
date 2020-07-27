require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var ffmpeg     = require('fluent-ffmpeg');
var uuid       = require('uuid').v4
const slash    = require('./slash.js')

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)
  
const createFileList = (camera, frames) => {
    const dirList = fs.readdirSync(path.resolve(process.env.imgDir, camera))
    const rand =  uuid();

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

    fs.writeFileSync(path.resolve(process.env.imgDir, `img_${rand}.txt`), files)
    return rand
}

const convert = (camera, fps, rand, save, res) => {

    if( !(save && save == "true") ) {
        res.attachment('output.mp4')
    }

    let videoCreator = ffmpeg(process.env.imgDir+`/img_${rand}.txt`)
        .inputFormat('concat') //ffmpeg(slash(path.join(process.env.imgDir,"img.txt"))).inputFormat('concat');
        .outputFPS(fps)
        .videoBitrate(1024)
        .videoCodec('libx264')
        .toFormat('mp4')
        .on('error', function(err) {
            console.log('An error occurred: ' + err.message);
        })
        .on('progress', function(progress) {
            console.log('Processing: ' + progress.frames + ' done');
        })
        .on('end', function() {
            console.log('Finished processing');
            fs.unlinkSync(path.resolve(process.env.imgDir, `img_${rand}.txt`))
        })

    const createVideo = (creator) => {
        if(save && save == "true"){
            creator
                .mergeToFile(`${process.env.imgDir}/output_${camera}_${rand}.mp4`, process.env.imgDir+'/') //.mergeToFile('output.mp4', path.relative(__dirname, path.resolve(process.env.imgDir)))
            
            res.send(JSON.stringify({
                id: rand,
                url: `http://${process.env.host}:${process.env.PORT}/shared/captures/output_${camera}_${rand}.mp4`
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

module.exports = {
    convert: (req, res) => {
        //console.log(req)
        const { camera, frames, save, fps } = req.body;
        console.log(camera, frames, fps)
        const rand = createFileList(camera, frames)
        convert(camera, fps, rand, save, res)
    },

    status: (req, res) => {
        const { id } = req.body
        console.log(id)
        res.send(JSON.stringify({
            running: fs.existsSync(path.resolve(process.env.imgDir, `img_${id}.txt`)),
            id
        }))
    }
}