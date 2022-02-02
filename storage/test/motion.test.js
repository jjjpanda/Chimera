const supertest = require('supertest');
const app = require('../backend/storage.js')

jest.mock('lib')
jest.mock('fs')
jest.mock('memory')
jest.mock('pm2')

const processList = [{
    name: `motion`,
    status: "on",
    restarts: 0
}]

describe('Motion Routes', () => {
    test('Unauthorized motion status', (done) => {
        supertest(app)
        .get('/motion/status')
        .expect(303, done)
    });

    test('motion status', (done) => {
        let cookieWithBearerToken =  "validCookie"
        supertest(app)
        .get('/motion/status')
        .set("Cookie", cookieWithBearerToken)
        .expect(200, processList, done)
    });
})