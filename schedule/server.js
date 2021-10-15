module.exports = () => {
    require('./backend/schedule.js')(process.env.schedule_ON === "true")
}