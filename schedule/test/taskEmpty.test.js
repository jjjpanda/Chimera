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
                //do nothing
            }
        },
        on: () => {}
    }),
    server: () => {}
}))

describe('Task Routes with an Empty list', () => {
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

    describe("/task/list", () => {
        test('List task', (done) => {
            supertest(app)
            .get('/task/list')
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { tasks : [] }, done)
        });
    })
    
    describe("/task/start", () => {
        test('Create task', (done) => {
            supertest(app)
            .post('/task/start')
            .send({url: "/convert/createVideo", body: JSON.stringify({}), cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { running: true }, done)
        });
    
        test('Create task with no url', (done) => {
            supertest(app)
            .post('/task/start')
            .send({body: JSON.stringify({}), cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "no url" }, done)
        });
    
        test('Create task with invalid url', (done) => {
            supertest(app)
            .post('/task/start')
            .send({url: "/not/valid", body: JSON.stringify({}), cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "no url" }, done)
        });
    
        test('Create task with no valid cronString', (done) => {
            supertest(app)
            .post('/task/start')
            .send({url: "/convert/createVideo", body: JSON.stringify({})})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "cron invalid" }, done)
        });
    
        test('Create task with no body', (done) => {
            supertest(app)
            .post('/task/start')
            .send({url: "/convert/createVideo", cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "no body" }, done)
        });
    
        test('Create task with invalid body', (done) => {
            supertest(app)
            .post('/task/start')
            .send({url: "/convert/createVideo", body: {}, cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "no body" }, done)
        });
    })
    
    describe("/task/stop", () => {
        test(`Stop task that doesn't exist`, (done) => {
            supertest(app)
            .post('/task/stop')
            .send({id: "literally any id"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "id invalid" }, done)
        });
    })

    describe("/task/destroy", () => {
        test(`Destroy task that doesn't exist`, (done) => {
            supertest(app)
            .post('/task/destroy')
            .send({id: "literally any id"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "id invalid" }, done)
        });
    })
})