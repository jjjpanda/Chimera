const normalizeHost = require("./normalizeHost.js")

module.exports = (key) => normalizeHost(process.env[key])
