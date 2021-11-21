const request = require('supertest');
const app = require('../backend/schedule.js')

describe('Heartbeat Health Route', function() {
    test('/schedule/health responds with 200', (done) => {
        request(app)
        .get('/schedule/health')
        .expect(200, done)
    });
});