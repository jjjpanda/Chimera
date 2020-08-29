require('dotenv').config()
var fs         = require('fs')
var path       = require('path')
const {
    filterType,
    parseFileName,
    findFile
}              = require('./converter.js');
const {
    sendAlert,
}              = require('../tools/alerts.js');

const imgDir = path.join(process.env.filePath, 'shared/captures')

module.exports = {
    statusProcess: (req, res) => {
        const { id } = req.body

        const { type } = parseFileName(findFile(id))

        console.log(id)
        res.send(JSON.stringify({
            running: fs.existsSync(path.resolve(imgDir, `${type}_${id}.txt`)),
            id
        }))
    },

    cancelProcess: (req, res) => {
        const { id } = req.body

        const { type } = parseFileName(findFile(id))

        let cancelled = true

        if(req.app.locals[id] != undefined){
            if(type == "mp4"){
                req.app.locals[id].kill()
                delete req.app.locals[id]
                sendAlert(`Your video (${id}) was cancelled.`)
            }
            else if(type == "zip"){
                req.app.locals[id].abort()
                delete req.app.locals[id]
                sendAlert(`Your archive (${id}) was cancelled.`)
            }
            
        }
        else{
            cancelled = false;
        }

        res.send(JSON.stringify({
            cancelled,
            id
        }))
    },
   
    listProcess: (req, res) => {
        let list = [...filterType('zip'), ...filterType('mp4')]

        list = list.map(file => {
            const { id, type } = parseFileName(file)

            return {
                ...parseFileName(file),
                requested: id.split('-')[1]+"-"+id.split('-')[2],
                running: fs.existsSync(path.resolve(imgDir, `${type}_${id}.txt`))
            }
        })

        res.send({
            list
        })
    },

    deleteProcess: (req, res) => {
        const { id } = req.body

        const file = findFile(id);

        console.log(id)
        let deletable = fs.existsSync(path.resolve(imgDir, file))

        if(deletable){
            fs.unlinkSync(path.resolve(imgDir, file))
        }
        
        res.send(JSON.stringify({
            deleted: deletable,
            id
        }))
    }
}