var shortid    = require("shortid")
const charList = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ()'
shortid.characters(charList)

module.exports = shortid