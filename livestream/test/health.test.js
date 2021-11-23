const supertest = require('supertest');
const app = require('../backend/livestream.js')

jest.mock('pm2', () => ({
    list: (callback) => {
        callback(null, [1, 2, 3].map((i) => ({
            name: `live_stream_cam_${i}`,
            pm2_env: {
                status: "on",
                unstable_restarts: 0
            }
        })))
    }
}))

describe('Heartbeat Health Route', () => {
    test('/livestream/health responds with 200', (done) => {
        supertest(app)
        .get('/livestream/health')
        .expect(200, done)
    });
});