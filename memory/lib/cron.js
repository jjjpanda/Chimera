const cron = require("node-cron")

module.exports = (cronString, cronTask) => { 
    const fileStatsCron = cron.schedule(cronString, cronTask)
    fileStatsCron.start()
}