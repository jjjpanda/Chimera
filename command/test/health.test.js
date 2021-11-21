const request = require('supertest');
const app = require('../backend/command.js')

describe('Heartbeat Health Route', function() {
    test('/command/health responds with 200', (done) => {
        request(app)
        .get('/command/health')
        .expect(200, done)
    });
});