require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
var ffmpeg     = require('fluent-ffmpeg');
var shortid    = require("shortid")
const request  = require('request');
var moment     = require('moment')
var archiver   = require('archiver');
const slash    = require('./slash.js')

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)
 
const fileName = (camera, start, end, id, type) => {
    return `output_${camera}_${start}_${end}_${id}.${type}`
}

const dateFormat = "YYYYMMDD-kkmmss"
const charList = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ[]'
shortid.characters(charList)

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

const randomID = () => {
    return shortid.generate() + "-" + moment().format(dateFormat);
}

const createFileList = (camera, start, end) => {
    const dirList = fs.readdirSync(path.resolve(process.env.imgDir, camera))
    const rand =  randomID()

    const filteredList = dirList.filter( file => file.includes(".jpg") && 
                        `${file.split("-")[0]}-${file.split('-')[1]}` > start && 
                        `${file.split("-")[0]}-${file.split('-')[1]}` <= end )

    const frames = filteredList.length    

    let files = ""

    console.log(start.split('-')[0], start.split('-')[1], end.split('-')[0], end.split('-')[1])
    
    for (const file of filteredList){
        files += `file '${camera}/${file}'\r\n` 
    }
    
    sendAlert(`Video Started:\nID: ${rand}\nCamera: ${camera}\nFrames: ${frames}\nStart: ${moment(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}\nEnd: ${moment(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
    fs.writeFileSync(path.resolve(process.env.imgDir, `img_${rand}.txt`), files)
    return { rand, frames }
}

const convert = (camera, fps, frames, start, end, rand, save, res) => {

    if( !(save || save == "true") ) {
        res.attachment('output.mp4')
    }

    let videoCreator = ffmpeg(process.env.imgDir+`/img_${rand}.txt`)
        .inputFormat('concat') //ffmpeg(slash(path.join(process.env.imgDir,"img.txt"))).inputFormat('concat');
        .outputFPS(fps)
        .videoBitrate(Math.pow(2, 14))
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
            console.log('Processing: ' + progress.frames + "/" + frames + ' done');
        })
        .on('end', function() {
            console.log('Finished processing');
            if(save || save == "true"){
                sendAlert(`Your video (${rand}) is finished. Download it at: http://${process.env.host}:${process.env.PORT}/shared/captures/${fileName(camera, start, end, rand, 'mp4')}`)
            }
            fs.unlinkSync(path.resolve(process.env.imgDir, `img_${rand}.txt`))
        })

    const createVideo = (creator) => {
        if(save || save == "true"){
            creator
                .mergeToFile(`${process.env.imgDir}/${fileName(camera, start, end, rand, 'mp4')}`, process.env.imgDir+'/') //.mergeToFile('output.mp4', path.relative(__dirname, path.resolve(process.env.imgDir)))
            
            res.send(JSON.stringify({
                id: rand,
                url: `http://${process.env.host}:${process.env.PORT}/shared/captures/${fileName(camera, start, end, rand, 'mp4')}`
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

const createZipList = (camera, start, end) => {
    var archive = archiver('zip', {
        zlib: {level: 9}
    })

    const dirList = fs.readdirSync(path.resolve(process.env.imgDir, camera))
    
    const filteredList = dirList.filter( file => file.includes(".jpg") && 
                        `${file.split("-")[0]}-${file.split('-')[1]}` > start && 
                        `${file.split("-")[0]}-${file.split('-')[1]}` <= end )

    const frames = filteredList.length    

    console.log(start.split('-')[0], start.split('-')[1], end.split('-')[0], end.split('-')[1])
    
    for (const file of filteredList){
        archive.file(path.resolve(process.env.imgDir, camera, file), {
            name: file
        }) 
    }

    return {frames, archive}
}

const zip = (archive, camera, frames, start, end, save, res) => {

    const rand = randomID()

    var output = fs.createWriteStream(`${process.env.imgDir}/${fileName(camera, start, end, rand, 'zip')}`)

    output.on('close', function() {
        if(save == "true"){
            sendAlert(`Your zip archive (${rand}) is finished. Download it at: http://${process.env.host}:${process.env.PORT}/shared/captures/${fileName(camera, start, end, rand, 'zip')}`)
        }
        fs.unlinkSync(path.resolve(process.env.imgDir, `zip_${rand}.progress`))
    });
    
    if(save == "true"){
        sendAlert(`ZIP Started:\nID: ${rand}\nCamera: ${camera}\nFrames: ${frames}\nStart: ${moment(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}\nEnd: ${moment(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
        res.send(JSON.stringify({
            id: rand,
            url: `http://${process.env.host}:${process.env.PORT}/shared/captures/${fileName(camera, start, end, rand, 'zip')}`
        }))
    }

    fs.writeFileSync(path.resolve(process.env.imgDir, `zip_${rand}.progress`), "progress")
    archive.pipe(output)
    archive.finalize()

    fs.createReadStream(output).pipe(res, {end: true})

    //fs.createReadStream(`${process.env.imgDir}/${fileName(camera, start, end, rand, 'zip')}`).pipe(res, {end: true})
}

module.exports = {
    validateRequest: (req, res, next) => {
        let { camera, start, end } = req.body;

        start = (start == undefined ? moment().subtract(1, "week") : moment(start, dateFormat)).format(dateFormat)

        end = (end == undefined ? moment() : moment(end, dateFormat)).format(dateFormat)
        
        if(camera == undefined){
            res.status(400)
        }
        else{
            camera = camera.toString()
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

    createVideo: (req, res) => {
        //console.log(req)
        let { camera, start, end, save, fps } = req.body;

        fps = fps == undefined ? 20 : fps

        console.log(camera, start, end, fps)
        const { rand, frames } = createFileList(camera, start, end)

        if(save == undefined || frames > 1000){
            save = true
        }

        convert(camera, fps, frames, start, end, rand, save, res)
    },

    statusVideo: (req, res) => {
        const { id } = req.body

        console.log(id)
        res.send(JSON.stringify({
            running: fs.existsSync(path.resolve(process.env.imgDir, `img_${id}.txt`)),
            id
        }))
    },

    cancelVideo: (req, res) => {
        const { id } = req.body

        res.send(JSON.stringify({
            nothing: "was done"
        }))
    },

    deleteVideo: (req, res) => {
        const { id } = req.body

        console.log(id)
        fs.unlinkSync(path.resolve(process.env.imgDir, fileName(camera, start, end, id, 'mp4')))
        res.send(JSON.stringify({
            deleted: id
        }))
    },

    createZip: (req, res) => {
        let { camera, start, end, save } = req.body;

        const {frames, archive} = createZipList(camera, start, end)

        if(save == undefined || frames > 250){
            save = true
        }

        zip(archive, camera, frames, start, end, save, res)
    },

    statusZip: (req, res) => {
        const { id } = req.body

        console.log(id)
        res.send(JSON.stringify({
            running: fs.existsSync(path.resolve(process.env.imgDir, `img_${id}.txt`)),
            id
        }))
    },

    cancelZip: (req, res) => {
        const { id } = req.body

    },

    deleteZip: (req, res) => {
        const { id } = req.body

    }

}