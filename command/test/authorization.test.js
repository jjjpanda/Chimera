const request = require('supertest');
const app = require('../backend/command.js')

const bcrypt = require("bcryptjs")
const mockedPassword = 'mockedPassword'
const hashedMockedPassword = bcrypt.hashSync(mockedPassword, bcrypt.genSaltSync(10))
let fs = require('fs')
fs.readFile = jest.fn().mockImplementation((filePath, options, callback) => callback(false, hashedMockedPassword))

describe('Authorization Routes', () => {
    test('Login with incorrect PIN', (done) => {
        request(app)
        .post('/authorization/requestLink')
        .send({pin: "NOT THE PIN"})
        .expect(400, done)
    });

    test('Login with correct PIN', (done) => {
        // let lib = require('lib')
        // lib.webhookAlert = jest.fn().mockImplementation((content, callback) => {})
        request(app)
        .post('/authorization/requestLink')
        .send({pin: process.env.templink_PIN})
        .expect(200, done)
    });

    test('Login with incorrect password', (done) => {
        request(app)
        .post('/authorization/login')
        .send({password: "incorrectPassword"})
        .expect(400, done)
    });

    test('Login with correct password', (done) => {
        request(app)
        .post('/authorization/login')
        .send({password: "mockedPassword"})
        .expect(200, done)
    });
})