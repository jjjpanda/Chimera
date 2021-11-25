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
            .expect(200, { tasks : [] }, done)
        })
    });

    test('Create task', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .post('/task/start')
            .send({url: "/convert/createVideo", body: JSON.stringify({}), cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(200, { running: true }, done)
        })
    });

    test('Create task with no url', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .post('/task/start')
            .send({body: JSON.stringify({}), cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "no url" }, done)
        })
    });

    test('Create task with invalid url', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .post('/task/start')
            .send({url: "/not/valid", body: JSON.stringify({}), cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "no url" }, done)
        })
    });

    test('Create task with no valid cronString', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .post('/task/start')
            .send({url: "/convert/createVideo", body: JSON.stringify({})})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "cron invalid" }, done)
        })
    });

    test('Create task with no body', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .post('/task/start')
            .send({url: "/convert/createVideo", cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "no body" }, done)
        })
    });

    test('Create task with invalid body', (done) => {
        supertest(command)
        .post('/authorization/login')
        .send({password: mockedPassword})
        .expect(200)
        .expect('set-cookie', /bearertoken=Bearer%20.*; Max-Age=.*/, (err, res) => {
            let cookieWithBearerToken = res.headers["set-cookie"]
            supertest(app)
            .post('/task/start')
            .send({url: "/convert/createVideo", body: {}, cronString: "*/10 * * * *"})
            .set("Cookie", cookieWithBearerToken)
            .expect(400, { error: "no body" }, done)
        })
    });
})