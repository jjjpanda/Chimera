const request = require('supertest');
const app = require('../backend/command.js')

describe('Web App Routes', () => {
    test('/ responds with 200', (done) => {
        request(app)
        .get('/')
        .expect(200, done)
    });
});