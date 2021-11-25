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
                args[0]({
                    taskid: {id: "taskid", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: true},
                    taskid2: {id: "taskid2", url: "/task/url2", cronString: "*/10 * * * *", body: {}, running: true},
                    taskid3: {id: "taskid3", url: "/task/url3", cronString: "*/10 * * * *", body: {}, running: true}
                })
            }
            else if(event == "startTask"){
                args[1](args[0])
            }
        },
        on: () => {}
    }),
    server: () => {}
}))

describe('Task Routes', () => {
    test('List task', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .get('/task/list')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { tasks : [
                {id: "taskid", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: true},
                {id: "taskid2", url: "/task/url2", cronString: "*/10 * * * *", body: {}, running: true},
                {id: "taskid3", url: "/task/url3", cronString: "*/10 * * * *", body: {}, running: true}
            ] }, done)
        })
    });
})