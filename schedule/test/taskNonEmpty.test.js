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
                    taskid1: {id: "taskid1", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: true},
                    taskid2: {id: "taskid2", url: "/task/url2", cronString: "*/10 * * * *", body: {}, running: true},
                    taskid3: {id: "taskid3", url: "/task/url3", cronString: "*/10 * * * *", body: {}, running: false}
                })
            }
            else if(event == "startTask"){
                args[1]({
                    taskid1: {id: "taskid1", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: true},
                    taskid2: {id: "taskid2", url: "/task/url2", cronString: "*/10 * * * *", body: {}, running: true},
                    taskid3: {id: "taskid3", url: "/task/url3", cronString: "*/10 * * * *", body: {}, running: true}
                })
            }
            else if(event == "stopTask"){
                args[1]({
                    taskid1: {id: "taskid1", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: true},
                    taskid2: {id: "taskid2", url: "/task/url2", cronString: "*/10 * * * *", body: {}, running: false},
                    taskid3: {id: "taskid3", url: "/task/url3", cronString: "*/10 * * * *", body: {}, running: true}
                })
            }
            else if(event == "destroyTask"){
                args[1]({
                    taskid2: {id: "taskid2", url: "/task/url2", cronString: "*/10 * * * *", body: {}, running: true},
                    taskid3: {id: "taskid3", url: "/task/url3", cronString: "*/10 * * * *", body: {}, running: true}
                })
            }
            else if(event == "savePassword"){
                args[1]()
            }
            else if(event == "verifyPassword"){
                args[1](false)
            }
        },
        on: () => {},
        off: () => {}
    }),
    server: () => {}
}))

describe('Task Routes With Non-Empty List', () => {
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

    describe("/task/list/", () => {
        test('List task', (done) => {
            supertest(app)
            .get('/task/list')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { tasks : [
                {id: "taskid1", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: true},
                {id: "taskid2", url: "/task/url2", cronString: "*/10 * * * *", body: {}, running: true},
                {id: "taskid3", url: "/task/url3", cronString: "*/10 * * * *", body: {}, running: false}
            ] }, done)
        });
    })
    
    describe("/task/start/", () => {
        test('Start task that was stopped', (done) => {
            supertest(app)
            .post('/task/start')
            .send({id: "taskid3"})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { running: true }, done)
        });
    
        test('Start task that is already running', (done) => {
            supertest(app)
            .post('/task/start')
            .send({id: "taskid1"})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { running: true }, done)
        });
    })
    
    describe("/task/stop", () => {
        test('Stop task that is running', (done) => {
            supertest(app)
            .post('/task/stop')
            .send({id: "taskid2"})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { stopped: true }, done)
        });
    
        test('Stop task that is already stopped', (done) => {
            supertest(app)
            .post('/task/stop')
            .send({id: "taskid3"})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { stopped: false }, done)
        });
    })
    
    describe("/task/destroy", () => {
        test('Destroy task that is running', (done) => {
            supertest(app)
            .post('/task/destroy')
            .send({id: "taskid1"})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { destroyed: true }, done)
        });
    })
})