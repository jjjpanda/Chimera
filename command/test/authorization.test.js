const supertest = require('supertest');
const app = require('../backend/command.js')

const mockedPassword = 'mockedPassword'

jest.mock('pg')
jest.mock('pm2')
jest.mock('axios')
jest.mock('memory')

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