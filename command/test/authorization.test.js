const supertest = require('supertest');
const app = require('../backend/command.js')

const { testLib } = require('lib')
const { mockedPassword, hashedMockedPassword } = testLib
let fs = require('fs')
fs.readFile = jest.fn().mockImplementation((filePath, options, callback) => {
    callback(false, hashedMockedPassword)
})

jest.mock('request', () => (options, callback) => {
    return JSON.parse(options.body).content
})

global.setTimeout = jest.fn()

describe('Authorization Routes', () => {
    test('Login with incorrect PIN', (done) => {
        supertest(app)
        .post('/authorization/requestLink')
        .send({pin: "NOT THE PIN"})
        .expect(400, done)
    });

    test('Login with correct PIN', (done) => {
        supertest(app)
        .post('/authorization/requestLink')
        .send({pin: process.env.templink_PIN})
        .expect(200, done)
    });

    test('Login with incorrect password', (done) => {
        supertest(app)
        .post('/authorization/login')
        .send({password: "incorrectPassword"})
        .expect(400, done)
    });

    test('Login with correct password', (done) => {
        supertest(app)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, done)
    });

    test('Login with correct password and verify', (done) => {
        supertest(app)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .post('/authorization/verify')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, done)
        })
    });

    test('Verify with wrong bearer token', (done) => {
        supertest(app)
        .post('/authorization/verify')
        .set("Cookie", "veryWrongBearerToken")
        .expect(401, done)
    });
})