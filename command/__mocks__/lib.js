const lib = jest.requireActual("lib")

lib.handleServerStart = jest.fn()
lib.auth.createAuthorize = jest.fn().mockReturnValue((req, res, next) => next())

module.exports = lib
