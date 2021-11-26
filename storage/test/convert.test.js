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
    "mp4_video3-20210301-235959.txt",
    "output_1_20210101-235959_20210201-235959_zip1-20210301-235959.zip",
]
const parsedFileList = fileList.filter(file => !file.includes('txt')).map((file) => {
    const obj = parseFileName(file)
    return {
        ...obj,
        running: obj.id.includes('video3')
    }
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
    else{
        callback(true, [])
    }
})
fs.stat = jest.fn().mockImplementation((filePath, callback) => {
    if(fileList.map(file => path.join(imgDir, file)).includes(filePath)){
        callback(false)
    }
    else{
        callback(true)
    }
})
fs.unlink = jest.fn().mockImplementation((filePath, callback) => {
    if(fileList.map(file => path.join(imgDir, file)).includes(filePath)){
        callback(false)
    }
    else{
        callback(true)
    }
})

jest.mock('memory', () => ({
    client: (name) => ({
        emit: (event, ...args) => {
            if(event == "savePassword"){
                args[1]()
            }
            else if(event == "verifyPassword"){
                args[1](false)
            }
        },
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
        test(`cancel a process`, (done) => {
            const id = "video3-20210301-235959"
            supertest(app)
            .post('/convert/cancelProcess')
            .send({id})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { cancelled: true, id }, done)
        })

        test(`cancel a process that doesn't exist`, (done) => {
            const id = "not_an_id"
            supertest(app)
            .post('/convert/cancelProcess')
            .send({id})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { cancelled: true, id }, done)
        })
    })

    describe("/convert/listProcess", () => {
        test('list processes', (done) => {
            supertest(app)
            .get('/convert/listProcess')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { list: parsedFileList }, done)
        })
    })

    describe("/convert/deleteProcess", () => {
        test(`delete a process`, (done) => {
            const id = "video1-20210301-235959"
            supertest(app)
            .post('/convert/deleteProcess')
            .send({id})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { deleted: true, id }, done)
        })

        test(`delete a process that doesn't exist`, (done) => {
            const id = "not-an-id"
            supertest(app)
            .post('/convert/deleteProcess')
            .send({id})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { deleted: false, id }, done)
        })
    })
})