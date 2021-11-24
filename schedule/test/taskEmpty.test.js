const supertest = require('supertest');
const app = require('../backend/schedule.js')
const command = require('command').app

const { testLib } = require('lib')
const { mockedPassword, hashedMockedPassword } = testLib
let fs = require('fs')
fs.readFile = jest.fn().mockImplementation((filePath, options, callback) => {
    callback(false, hashedMockedPassword)
})

jest.mock('memory', () => ({
    client: (name) => ({
        emit: (event, ...args) => {
            if(event == "listTask"){
                args[0]({})
            }
            else if(event == "createTask"){
                args[1]({[args[0].id] : args[0]})
            }
        },
        on: () => {}
    }),
    server: () => {}
}))

describe('Task Routes', () => {
    test('Task List', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .get('/task/list')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { tasks : [] }, done)
        })
    });
})