const supertest = require('supertest');
const app = require('../backend/livestream.js')
const command = require('command').app

const { testLib } = require('lib')
const { mockedPassword, hashedMockedPassword } = testLib
let fs = require('fs')
fs.readFile = jest.fn().mockImplementation((filePath, options, callback) => {
    callback(false, hashedMockedPassword)
})

const processList = [1, 2, 3].map((i) => ({
    name: `live_stream_cam_${i}`,
    status: "on",
    restarts: 0
}))

jest.mock('pm2', () => ({
    list: (callback) => {
        callback(null, [1, 2, 3].map((i) => ({
            name: `live_stream_cam_${i}`,
            pm2_env: {
                status: "on",
                unstable_restarts: 0
            }
        })))
    }
}))

describe('Livestream Routes', () => {
    test('Unauthorized livestream status', (done) => {
        supertest(app)
        .get('/livestream/status')
        .expect(303, done)
    });

    describe("Authorized Livestream Status", () => {
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

        test('Livestream status', (done) => {
            supertest(app)
            .get('/livestream/status')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, {processList}, done)
        });
    
        test('Livestream status of specific camera', (done) => {
            supertest(app)
            .get('/livestream/status?camera=1')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, {processList: [ processList[0] ]}, done)
        });
    
        test(`Livestream status of specific camera that doesn't exist`, (done) => {
            supertest(app)
            .get('/livestream/status?camera=9999')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, {processList: []}, done)
        });
    })
})