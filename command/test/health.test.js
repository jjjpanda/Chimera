const supertest = require('supertest');
const app = require('../backend/command.js')

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

describe('Heartbeat Health Route', () => {
    test('/command/health responds with 200', (done) => {
        supertest(app)
        .get('/command/health')
        .expect(200, done)
    });
});