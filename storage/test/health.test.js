const supertest = require('supertest');
const app = require('../backend/storage.js')

jest.mock('pm2', () => ({
    list: (callback) => {
        callback(null, [{
            name: `motion`,
            pm2_env: {
                status: "on",
                unstable_restarts: 0
            }
        }])
    }
}))

jest.mock('memory', () => ({
    client: (name) => ({
        emit: () => {},
        on: () => {}
    }),
    server: () => {}
}))

describe('Heartbeat Health Route', () => {
    test('/storage/health responds with 200', (done) => {
        supertest(app)
        .get('/storage/health')
        .expect(200, done)
    });
});