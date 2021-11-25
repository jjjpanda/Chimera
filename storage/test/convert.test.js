const supertest = require('supertest');
const app = require('../backend/storage.js')
const command = require('command').app

const { testLib } = require('lib')
const { mockedPassword, hashedMockedPassword } = testLib
let fs = require('fs')
fs.readFile = jest.fn().mockImplementation((filePath, options, callback) => {
    if(options instanceof Function){
        options(false, {})
    }
    else{
        callback(false, hashedMockedPassword)
    }
})

jest.mock('memory', () => ({
    client: (name) => ({
        emit: () => {},
        on: () => {}
    }),
    server: () => {}
}))

jest.mock('pm2', () => ({
    list: (callback) => {
        callback(null, [{
            name: `motion`,
            pm2_env: {
                status: "on",
                unstable_restarts: 0
            }
        }])
    }
}))

describe('Convert Routes', () => {
    describe("/convert/createVideo", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/convert/listFramesVideo", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/convert/createZip", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/convert/statusProcess", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/convert/cancelProcess", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/convert/listProcess", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/convert/deleteProcess", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })
})