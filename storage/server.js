module.exports = () => {
    require('./backend/storage.js')(process.env.storage == "on")
}