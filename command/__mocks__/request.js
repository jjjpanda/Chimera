module.exports = (options, callback) => {
    return JSON.parse(options.body).content
}