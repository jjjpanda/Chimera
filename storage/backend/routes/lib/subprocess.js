const pm2 = require('pm2')
const process = require('process')
const mkdirp = require('mkdirp')

module.exports = {
    startMotion: () => {
        console.log("\t▶ Starting Motion Process")
        createMotionDirectory(safeStartMotionProcess)
    }
}

const createMotionDirectory = (callback) => {
    mkdirp(`${process.env.storage_FILEPATH}shared/captures`).then(callback)
}

const safeStartMotionProcess = () => {
    stopMotion(startMotionProcess)
}

const startMotionProcess = () => {
    pm2.start({
        script: `motion -c ${process.env.storage_MOTION_CONFPATH}`,
        name: "motion"
    }, onMotionStart)
}

const onMotionStart = (err, apps) => {
    if(err){
        console.log("\tCouldn't Start Motion Process ⚠")
    }
    process.on('SIGINT', stopMotion)
}

const stopMotion = (callback=defaultStopMotionCallback) => {
    pm2.stop("motion", callback)
}

const defaultStopMotionCallback = () => {
    console.log("Motion Off")
}