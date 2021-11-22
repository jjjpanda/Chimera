const supertest = require('supertest');
const app = require('../backend/livestream.js')

describe('Heartbeat Health Route', () => {
    test('/livestream/health responds with 200', (done) => {
        supertest(app)
        .get('/livestream/health')
        .expect(200, done)
    });
});