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

const processList = [{
    name: `motion`,
    status: "on",
    restarts: 0
}]

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

describe('Motion Routes', () => {
    test('Unauthorized motion status', (done) => {
        supertest(app)
        .get('/motion/status')
        .expect(303, done)
    });

    test('motion status', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .get('/motion/status')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, {processList}, done)
        })
    });
})