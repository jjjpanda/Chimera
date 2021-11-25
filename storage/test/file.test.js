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

describe('File Routes', () => {
    let cookieWithBearerToken
    beforeAll((done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => { 
            cookieWithBearerToken = res.headers["set-cookie"]
            done()
        })
    })

    describe("/file/pathStats", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathSize", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathFileCount", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathMetrics", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathDelete", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathClean", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })
})