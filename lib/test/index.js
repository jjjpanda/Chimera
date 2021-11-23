const bcrypt = require("bcryptjs")
const mockedPassword = 'mockedPassword'
const hashedMockedPassword = bcrypt.hashSync(mockedPassword, bcrypt.genSaltSync(10))

module.exports = {
    mockedPassword, hashedMockedPassword
}