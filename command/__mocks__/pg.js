const bcrypt = jest.requireActual("bcryptjs")
const hashedMockedPassword = bcrypt.hashSync('mockedPassword', bcrypt.genSaltSync(10))

const queryObject = {
    query: (str, callback) => callback(null, {rows: [{hash: hashedMockedPassword}]})
}
const mockedPool = {
    connect: () => {
        return queryObject
    },
    ...queryObject,
    end: jest.fn(),
    on: jest.fn()
}

const pg = {
    Pool: jest.fn(() => mockedPool)
}

module.exports = pg