const process = require('process')

module.exports = (app, port, logCallback, closeCallback) => {
    const server = app.listen(port, logCallback)
    process.on('SIGINT', () => {
        server.close()
        closeCallback()
    })
}