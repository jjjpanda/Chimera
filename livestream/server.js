module.exports = () => {
    require('./backend/livestream.js')(process.env.livestream_ON === "true")
}