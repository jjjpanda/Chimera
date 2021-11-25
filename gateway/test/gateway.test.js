const supertest = require('supertest');
const command = require('command').app
const {handleServerStart} = require('lib')
const gateway = require('../server.js').app

describe('Gateway Tests', () => {
    test('Gateway Timeout when proxied server is down', (done) => {
        supertest(gateway)
        .get('/')
        .expect(504, done)
    });

    test('Gateway works when proxied server is up', (done) => {
        const server = handleServerStart(command, process.env.command_PORT, () => {
            supertest(gateway)
            .get('/')
            .expect(200, (err) => {
                server.close()
                done(err)
            })
        })
    });
})