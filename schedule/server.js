module.exports = () => {
    require('./backend/schedule.js')(process.env.schedule == "on")
}