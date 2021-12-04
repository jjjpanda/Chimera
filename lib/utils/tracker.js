module.exports = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"]
    console.log(ip, userAgent)

    next()
}