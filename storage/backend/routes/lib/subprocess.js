const pm2 = require('pm2')
const process = require('process')

let processes = []

module.exports = {
    startMotion: () => {
        console.log("\t▶ Starting Motion Process")
        pm2.stop("motion", () => {
            pm2.start({
                script: `motion -c ${process.env.storage_MOTION_CONFPATH}`,
                name: "motion"
            }, (err, apps) => {
                if(err){
                    console.log("\tCouldn't Start Motion Process ⚠")
                }
                processes.push({name: 'motion', log: "Motion Off"})
            })
        })
    },

    processListMiddleware: (req, res) => {
        const {processName} = req
        processList((list) => {
            const processRunning = list.find((p) => {
                return p.name && p.name == processName
            }).length > 0
            res.send({processRunning})
        })
    }
}

const processList = (callback) => {
    pm2.list((err, list) => {
        callback(err ? [] : list)
    })
}

process.on('SIGINT', () => {
    processes.forEach((p) => {
        pm2.stop(p.name, () => {
            console.log(p.log)
        })
    })
})