const process = require('process')

module.exports = (app, port, isOn, successCallback, failureCallback) => {
    if(isOn){
        const server = app.listen(port, successCallback)
        process.on('SIGINT', () => {
            server.close()
            failureCallback()
        })
    }
    else{
        failureCallback()
    }
}