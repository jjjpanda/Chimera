const cron = require("node-cron")

let fileStatsCron

module.exports = (io) => (cronString, cronTaskID) => { 
    fileStatsCron = cron.schedule(cronString, () => {
        io.emit(cronTaskID)
    })
    fileStatsCron.start()
}