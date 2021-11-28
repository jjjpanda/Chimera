const supertest = require('supertest');
const app = require('../backend/storage.js')

jest.mock('lib')
jest.mock('fs')
jest.mock('memory')
jest.mock('pm2')

describe('File Routes', () => {
    let cookieWithBearerToken = "validCookie"

    describe("/file/pathStats", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathSize", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathFileCount", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathMetrics", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathDelete", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })

    describe("/file/pathClean", () => {
        test('bruh', () => expect(2+2).toBe(4))
    })
})