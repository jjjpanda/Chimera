const supertest = require('supertest');
const app = require('../backend/command.js')

const { testLib } = require('lib')
const { mockedPassword, hashedMockedPassword } = testLib
let fs = require('fs');
fs.readFile = jest.fn().mockImplementation((filePath, options, callback) => {
    callback(false, hashedMockedPassword)
})

jest.mock('pm2', () => ({
    list: jest.fn()
}))

jest.mock('request', () => (options, callback) => {
    console.log("REQUESY MOCK")
    return JSON.parse(options.body).content
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

describe('Authorization Routes', () => {
    describe("/authorization/requestLink", () => {
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
    })
    
    describe("/authorization/login", () => {
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

        test('Login with no password', (done) => {
            supertest(app)
            .post('/authorization/login')
            .expect(400, { error: true, msg: "no body" }, done)
        });
    })
    
    describe("/authorization/verify", () => {
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
})