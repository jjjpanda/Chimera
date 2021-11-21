const request = require('supertest');
const app = require('../backend/storage.js')

describe('Heartbeat Health Route', function() {
    test('/storage/health responds with 200', (done) => {
        request(app)
        .get('/storage/health')
        .expect(200, done)
    });
});