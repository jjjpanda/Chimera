const webhookAlert = require('./webhookAlert.js')

module.exports = (req, res, next) => {
    if(req.method == "POST"){
        const forwardedfor = req.headers['x-forwarded-for']
        const remoteAddress =  req.connection.remoteAddress;
        const userAgent = req.headers["user-agent"]
        webhookAlert(`${req.path} | SOURCE: ${remoteAddress} - ${forwardedfor}\nUSER-AGENT: ${userAgent}`, 'admin')
    }
    next()
}