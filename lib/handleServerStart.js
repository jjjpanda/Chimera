const process = require('process')

module.exports = (app, port, isOn, onLog, offLog, host) => {
    if(isOn){
        const server = host ? app.listen(port, host, onLog) : app.listen(port, onLog)
        process.on('SIGINT', () => {
            server.close()
            offLog()
        })
    }
    else{
        offLog()
    }
}