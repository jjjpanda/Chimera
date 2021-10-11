const process = require('process')

module.exports = (app, port, isOn, onLog, offLog) => {
    if(isOn){
        const server = app.listen(port, onLog)
        process.on('SIGINT', () => {
            server.close()
            offLog()
        })
    }
    else{
        offLog()
    }
}