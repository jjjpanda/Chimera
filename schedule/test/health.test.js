const supertest = require('supertest');
const app = require('../backend/schedule.js')

jest.mock('memory', () => ({
    client: () => {},
    server: () => {}
}))

describe('Heartbeat Health Route', () => {
    test('/schedule/health responds with 200', (done) => {
        supertest(app)
        .get('/schedule/health')
        .expect(200, done)
    });
});