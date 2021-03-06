require('dotenv').config()
var ffmpeg     = require('fluent-ffmpeg');
const slash    = require('./slash.js')
var fs         = require('fs')
var path       = require('path')
var moment     = require('moment')
var dateFormat = require('./dateFormat.js')
const {
    randomID,
    filterList,
    fileName,
}              = require('./converter.js')
const {
    sendConvertAlert,
}              = require('../tools/alerts.js');

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)

const imgDir = path.join(process.env.filePath, 'shared/captures')

const createFrameList = (camera, start, end, limit) => {
    const filteredList = filterList(camera, start, end)

    const limitIteration = Math.ceil(filteredList.length/limit)

    console.log(filteredList.length, limitIteration)

    const limitedList = filteredList.filter((item, index) => {
        return (index % limitIteration === 0)
    }).map((item) => {
        return `http://${process.env.converterHost}:${process.env.PORT}/shared/captures/${camera}/${item}`
    })

    return limitedList
}

const createVideoList = (camera, start, end, skip) => {
    const rand = randomID()

    const filteredList = filterList(camera, start, end, skip)

    const frames = filteredList.length    

    let files = ""

    console.log(start.split('-')[0], start.split('-')[1], end.split('-')[0], end.split('-')[1])
    
    for (const file of filteredList){
        files += `file '${camera}/${file}'\r\n` 
    }
    
    fs.writeFileSync(path.resolve(imgDir, `mp4_${rand}.txt`), files)
    return { rand, frames }
};

const video = (camera, fps, frames, start, end, rand, save, req, res) => {

    if(frames == 0){
        if(save){
            sendConvertAlert(`Video Process:\nID: ${rand}\nCamera: ${camera}\nNot started: has ${frames} frames`)
        }
        else{
            res.send(JSON.stringify({
                id: rand,
                url: undefined,
            }))
        }
    }
    else {
        if(save){
            console.log("SENDING START ALERT")
            sendConvertAlert(`Video Started:\nID: ${rand}\nCamera: ${camera}\nFrames: ${frames}\nStart: ${moment(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}\nEnd: ${moment(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
        }
        else{
            res.attachment(fileName(camera, start, end, rand, 'mp4'))
        }
    
        let videoCreator = ffmpeg(imgDir+`/mp4_${rand}.txt`)
            .inputFormat('concat') //ffmpeg(slash(path.join(imgDir,"img.txt"))).inputFormat('concat');
            .outputFPS(fps)
            .videoBitrate(Math.pow(2, 14))
            .videoCodec('libx264')
            .toFormat('mp4')
            .on('error', function(err) {
                console.log('An error occurred: ' + err.message);
                if(save){
                    sendConvertAlert(`Your video (${rand}) could not be completed.`)
                }    
                fs.unlinkSync(path.resolve(imgDir, `mp4_${rand}.txt`))
            })
            .on('progress', function(progress) {
                console.log('Processing: ' + progress.frames + "/" + frames + ' done');
            })
            .on('end', function() {
                console.log('Finished processing');
                if(save){
                    console.log("SENDING END ALERT")
                    sendConvertAlert(`Your video (${rand}) is finished. Download it at: http://${process.env.converterHost}:${process.env.PORT}/shared/captures/${fileName(camera, start, end, rand, 'mp4')}`)
                }
                fs.unlinkSync(path.resolve(imgDir, `mp4_${rand}.txt`))
            })

        req.app.locals[rand] = videoCreator

        const createVideo = (creator) => {
            if(save){
                creator
                    .mergeToFile(`${imgDir}/${fileName(camera, start, end, rand, 'mp4')}`, imgDir+'/') //.mergeToFile('output.mp4', path.relative(__dirname, path.resolve(imgDir)))
                
                res.send(JSON.stringify({
                    id: rand,
                    frameLimitMet: req.body.frameLimitMet,
                    url: `http://${process.env.converterHost}:${process.env.PORT}/shared/captures/${fileName(camera, start, end, rand, 'mp4')}`
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

}

module.exports = {
    createVideo: (req, res) => {
        //console.log(req)
        let { camera, start, end, save, fps, skip } = req.body;

        fps = fps == undefined ? 20 : fps

        skip = skip == undefined ? 1 : skip

        console.log(camera, start, end, fps)
        const { rand, frames } = createVideoList(camera, start, end, skip)

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
    },

    listOfFrames: (req, res) => {

        let { camera, start, end, frames } = req.body;

        if(frames == undefined){
            frames = 10
        }

        const list = createFrameList(camera, start, end, frames)

        res.send(JSON.stringify({
            list
        }))

    }
}