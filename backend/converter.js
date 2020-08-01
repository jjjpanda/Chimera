require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var ffmpeg     = require('fluent-ffmpeg');
var shortid    = require("shortid")
const request  = require('request');
var moment     = require('moment')
const slash    = require('./slash.js')

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)
 
const videoName = (camera, start, end, id) => {
    return `output_${camera}_${start}_${end}_${id}.mp4`
}

const dateFormat = "YYYYMMDD-kkmmss"

const sendAlert = (content) => {
    request({
        method: "POST",
        url: process.env.alertURL,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content
        }),
    }, (error, response, body) => {
        if (!error) {
            console.log('Alert Sent')
        } else {
            console.log("Error sending alert: ", error)
        }
    });
}

const createFileList = (camera, start, end) => {
    const dirList = fs.readdirSync(path.resolve(process.env.imgDir, camera))
    const rand =  shortid.generate();

    let files = ""

    console.log(start.split('-')[0], start.split('-')[1], end.split('-')[0], end.split('-')[1])
    
    for (const file of dirList.filter( file => file.includes(".jpg") && 
            `${file.split("-")[0]}-${file.split('-')[1]}` > start && 
            `${file.split("-")[0]}-${file.split('-')[1]}` <= end )){
        files += `file '${camera}/${file}'\r\n` 
    }
    
    sendAlert(`Video Started:\nID: ${rand}\nStart: ${moment(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}\nEnd: ${moment(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
    fs.writeFileSync(path.resolve(process.env.imgDir, `img_${rand}.txt`), files)
    return rand
}

const convert = (camera, fps, start, end, rand, save, res) => {

    if( !(save || save == "true") ) {
        res.attachment('output.mp4')
    }

    let videoCreator = ffmpeg(process.env.imgDir+`/img_${rand}.txt`)
        .inputFormat('concat') //ffmpeg(slash(path.join(process.env.imgDir,"img.txt"))).inputFormat('concat');
        .outputFPS(fps)
        .videoBitrate(65536)
        .videoCodec('libx264')
        .toFormat('mp4')
        .on('error', function(err) {
            console.log('An error occurred: ' + err.message);
            if(save || save == "true"){
                sendAlert(`Your video (${rand}) could not be completed.`)
            }    
            fs.unlinkSync(path.resolve(process.env.imgDir, `img_${rand}.txt`))
        })
        .on('progress', function(progress) {
            console.log('Processing: ' + progress.frames + ' done');
        })
        .on('end', function() {
            console.log('Finished processing');
            if(save || save == "true"){
                sendAlert(`Your video (${rand}) is finished. Download it at: http://${process.env.host}:${process.env.PORT}/shared/captures/${videoName(camera, start, end, rand)}`)
            }
            fs.unlinkSync(path.resolve(process.env.imgDir, `img_${rand}.txt`))
        })

    const createVideo = (creator) => {
        if(save || save == "true"){
            creator
                .mergeToFile(`${process.env.imgDir}/${videoName(camera, start, end, rand)}`, process.env.imgDir+'/') //.mergeToFile('output.mp4', path.relative(__dirname, path.resolve(process.env.imgDir)))
            
            res.send(JSON.stringify({
                id: rand,
                url: `http://${process.env.host}:${process.env.PORT}/shared/captures/${videoName(camera, start, end, rand)}`
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
    validateVideoDetails: (req, res, next) => {
        const { camera, fps } = req.body;
        
        if(camera == undefined || fps == undefined){
            res.status(400)
        }
        else{
            next()
        }
    },

    validateID: (req, res, next) => {
        const { id } = req.body
        
        if(id == undefined){
            res.status(400)
        }
        else{
            next()
        }
    },

    convert: (req, res) => {
        //console.log(req)
        let { camera, start, end, save, fps } = req.body;

        start = (start == undefined ? moment().subtract(12, "hours") : moment(start, dateFormat)).format(dateFormat)

        end = (end == undefined ? moment() : moment(end, dateFormat)).format(dateFormat)
        
        camera = camera.toString()

        console.log(camera, start, end, fps)
        const rand = createFileList(camera, start, end)
        convert(camera, fps, start, end, rand, save, res)
    },

    status: (req, res) => {
        const { id } = req.body

        console.log(id)
        res.send(JSON.stringify({
            running: fs.existsSync(path.resolve(process.env.imgDir, `img_${id}.txt`)),
            id
        }))
    },

    deleteVideo: (req, res) => {
        const { id } = req.body

        console.log(id)
        fs.unlinkSync(path.resolve(process.env.imgDir, videoName(camera, start, end, id)))
        res.send(JSON.stringify({
            deleted: id
        }))
    }
}