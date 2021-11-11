var archiver   = require('archiver');
var dateFormat = require('./dateFormat.js')
var fs         = require('fs')
var path       = require('path')
var moment     = require('moment')
const {
    randomID,
    filterList,
    fileName,
}              = require('./converter.js');
const {webhookAlert} = require('lib')

const imgDir = path.join(process.env.storage_FILEPATH, 'shared/captures')

const createZipList = (camera, start, end, skip) => {
    var archive = archiver('zip', {
        zlib: {level: 9}
    })

    const filteredList = filterList(camera, start, end, skip)

    const frames = filteredList.length    

    console.log(start.split('-')[0], start.split('-')[1], end.split('-')[0], end.split('-')[1])
    
    for (const file of filteredList){
        archive.file(path.join(imgDir, camera, file), {
            name: file
        }) 
    }

    return {frames, archive}
};

const zip = (archive, camera, frames, start, end, save, req, res) => {

    const rand = randomID()

    if(frames == 0){
        if(save){
            webhookAlert(`Zip Process:\nID: ${rand}\nCamera: ${camera}\nNot started: has ${frames} frames`)
        }
        else{
            res.send(JSON.stringify({
                id: rand,
                url: undefined
            }))
        }
    }
    else{
        if(save){
            var output = fs.createWriteStream(`${imgDir}/${fileName(camera, start, end, rand, 'zip')}`)
        
            console.log("SENDING START ALERT")
            webhookAlert(`ZIP Started:\nID: ${rand}\nCamera: ${camera}\nFrames: ${frames}\nStart: ${moment(start, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}\nEnd: ${moment(end, dateFormat).format("dddd, MMMM Do YYYY, h:mm:ss a")}`)

            output.on('close', function() {
                console.log("SENDING END ALERT")
                webhookAlert(`Your zip archive (${rand}) is finished. Download it at: ${process.env.gateway_HOST}/shared/captures/${fileName(camera, start, end, rand, 'zip')}`)
                fs.unlinkSync(path.join(imgDir, `zip_${rand}.txt`))
            });    

            archive.on('error', function(err) {
                console.log('An error occurred: ' + err.message);
                if(save){
                    webhookAlert(`Your zip (${rand}) could not be completed.`)
                }    
                fs.unlinkSync(path.join(imgDir, `zip_${rand}.txt`))
            });
            
            fs.writeFileSync(path.join(imgDir, `zip_${rand}.txt`), "progress")

            archive.pipe(output)

            req.app.locals[rand] = archive

            res.send(JSON.stringify({
                id: rand,
                frameLimitMet: req.body.frameLimitMet,
                url: `/shared/captures/${fileName(camera, start, end, rand, 'zip')}`
            }))
        }
        else{
            res.attachment(fileName(camera, start, end, rand, 'zip'))
            archive.pipe(res, {end: true})
        }

        archive.finalize()
    }

}

module.exports = {
    createZip: (req, res) => {
        let { camera, start, end, save, skip } = req.body;

        skip = skip == undefined ? 1 : skip

        const {frames, archive} = createZipList(camera, start, end, skip)

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

        zip(archive, camera, frames, start, end, save, req, res)
    }
}