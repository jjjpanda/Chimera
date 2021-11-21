const request = require('supertest');
const app = require('../backend/livestream.js')

describe('Heartbeat Health Route', function() {
    test('/livestream/health responds with 200', (done) => {
        request(app)
        .get('/livestream/health')
        .expect(200, done)
    });
});