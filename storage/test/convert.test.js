const supertest = require('supertest');
const app = require('../backend/storage.js')
const command = require('command').app
const path       = require("path")
var {generateID, fileName, parseFileName}    = require("../backend/routes/lib/converter.js")

const imgDir = path.join(process.env.storage_FILEPATH, "shared/captures")

const fileList = [
    "output_1_20210101-235959_20210201-235959_video1-20210301-235959.mp4", 
    "output_1_20210101-235959_20210201-235959_video2-20210301-235959.mp4",
    "output_1_20210101-235959_20210201-235959_video3-20210301-235959.mp4",
    "output_1_20210101-235959_20210201-235959_zip1-20210301-235959.zip",
]
const parsedFileList = fileList.map((file) => {
    return parseFileName(file)
    /* {
        link: `${process.env.gateway_HOST}/shared/captures/output_1_20210101-235959_20210201-235959_video1-20210301-235959.mp4`,
        type: "mp4",
        id: "video1",
        requested: "20210301-235959",
        camera: 1,
        start: "20210101-235959",  // dateTime,
        end: "20210201-235959", //dateTime,
        running: false
    } */
})

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
fs.readdir = jest.fn().mockImplementation((filePath, callback) => {
    if(filePath == imgDir){
        callback(false, fileList)
    }
})
fs.stat = jest.fn().mockImplementation((filePath, callback) => {
    callback(true, {})
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
        test('bruh', (done) => {
            supertest(app)
            .get('/convert/listProcess')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { list: parsedFileList.map(fileObj => ({...fileObj, running: false})) }, done)
        })
    })

    describe("/convert/deleteProcess", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })
})