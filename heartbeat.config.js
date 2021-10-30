require('dotenv').config()

const baseUrl = `http://${process.env.command_HOST}`
module.exports = {
    checkUrl: {
        command: `${baseUrl}/command/health`,
        livestream: `${baseUrl}/livestream/health`,
        schedule: `${baseUrl}/schedule/health`,
        storage: `${baseUrl}/storage/health`
    },
    webhookUrl: process.env.alert_URL,
    cronString: "*/10 * * * *",
    consoleOutput: true
}