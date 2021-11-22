const supertest = require('supertest');
const app = require('../backend/command.js')

describe('Heartbeat Health Route', () => {
    test('/command/health responds with 200', (done) => {
        supertest(app)
        .get('/command/health')
        .expect(200, done)
    });
});