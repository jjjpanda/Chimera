module.exports = () => {
    require('./backend/command.js')(process.env.command_ON === "true")
}
