require('dotenv').config()
var ffmpeg     = require('fluent-ffmpeg');
const slash    = require('./slash.js')
var dateFormat = require('./dateFormat.js')
const {
    sendAlert,
    randomID,
    filterList,
    fileName
}              = require('./converter.js')

ffmpeg.setFfmpegPath(process.env.ffmpeg)
ffmpeg.setFfprobePath(process.env.ffprobe)

const createVideoList = (camera, start, end) => {
    const rand = randomID()

    const filteredList = filterList(camera, start, end)

    const frames = filteredList.length    

    let files = ""

    console.log(start.split('-')[0], start.split('-')[1], end.split('-')[0], end.split('-')[1])
    
    for (const file of filteredList){
        files += `file '${camera}/${file}'\r\n` 
    }
    
    fs.writeFileSync(path.resolve(process.env.imgDir, `img_${rand}.txt`), files)
    return { rand, frames }
};

const video = (camera, fps, frames, start, end, rand, save, req, res) => {

    if(frames == 0){
        if(save){
            sendAlert(`Video Process:\nID: ${rand}\nCamera: ${camera}\nNot started: has ${frames} frames`)
        }
        else{
            res.send(JSON.stringify({
                id: rand,
                url: undefined
            }))
        }
    }
    else {
        if(save){
            console.log("SENDING START ALERT")
            sendAlert(`Video Started:\nID: ${rand}\nCamera: ${camera}\nFrames: ${frames}\nStart: ${moment(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}\nEnd: ${moment(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
        }
        else{
            res.attachment(fileName(camera, start, end, rand, 'mp4'))
        }
    
        let videoCreator = ffmpeg(process.env.imgDir+`/img_${rand}.txt`)
            .inputFormat('concat') //ffmpeg(slash(path.join(process.env.imgDir,"img.txt"))).inputFormat('concat');
            .outputFPS(fps)
            .videoBitrate(Math.pow(2, 14))
            .videoCodec('libx264')
            .toFormat('mp4')
            .on('error', function(err) {
                console.log('An error occurred: ' + err.message);
                if(save){
                    sendAlert(`Your video (${rand}) could not be completed.`)
                }    
                fs.unlinkSync(path.resolve(process.env.imgDir, `img_${rand}.txt`))
            })
            .on('progress', function(progress) {
                console.log('Processing: ' + progress.frames + "/" + frames + ' done');
            })
            .on('end', function() {
                console.log('Finished processing');
                if(save){
                    console.log("SENDING END ALERT")
                    sendAlert(`Your video (${rand}) is finished. Download it at: http://${process.env.host}:${process.env.PORT}/shared/captures/${fileName(camera, start, end, rand, 'mp4')}`)
                }
                fs.unlinkSync(path.resolve(process.env.imgDir, `img_${rand}.txt`))
            })

        req.app.locals[rand] = videoCreator

        const createVideo = (creator) => {
            if(save){
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

}

module.exports = {
    createVideo: (req, res) => {
        //console.log(req)
        let { camera, start, end, save, fps } = req.body;

        fps = fps == undefined ? 20 : fps

        console.log(camera, start, end, fps)
        const { rand, frames } = createVideoList(camera, start, end)

        if(save == undefined || save == true || frames > 250 || save == "true"){
            save = true
        }
        else{
            save = false
        }

        video(camera, fps, frames, start, end, rand, save, req, res)
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

        req.app.locals[id].kill()
        fs.unlinkSync(path.resolve(process.env.imgDir, `img_${id}.txt`))

        res.send(JSON.stringify({
            cancelled: id
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
}