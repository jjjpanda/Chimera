const supertest = require('supertest');
const app = require('../backend/livestream.js')

jest.mock('pm2')
jest.mock('axios')

describe('Heartbeat Health Route', () => {
    test('/livestream/health responds with 200', (done) => {
        supertest(app)
        .get('/livestream/health')
        .expect(200, done)
    });
});