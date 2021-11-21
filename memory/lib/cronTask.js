const cron = require("node-cron")

let fileStatsCron

module.exports = (cronString, cronTask) => { 
    fileStatsCron = cron.schedule(cronString, cronTask)
    fileStatsCron.start()
}