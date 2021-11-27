const supertest = require('supertest');
const app = require('../backend/storage.js')

var {generateID, fileName, parseFileName}    = require("../backend/routes/lib/converter.js")

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

jest.mock('lib')
jest.mock('fs')
jest.mock('memory')
jest.mock('pm2')

describe('Convert Routes', () => {
    let cookieWithBearerToken = "validCookie"

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