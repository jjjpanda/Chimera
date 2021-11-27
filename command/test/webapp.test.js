const supertest = require('supertest');
const app = require('../backend/command.js')

jest.mock('memory')

describe('Web App Routes', () => {
    const webAppRoutes = ["/", "/live/", "/process/", "/scrub/", "/stats/", "/login/"]

    test(`Web app routes respond with 200`, (done) => { 
        Promise.all(webAppRoutes.map(route => (resolve, reject) => {
            supertest(app)
            .get(route)
            .expect(200, (err) => {
                if(!err) resolve()
                else reject(`route ${route} failed`)
            })
        })).then(() => {
            done()
        }, (err) => {
            done(err)
        })
    });

    test(`Nonexistent route responds with 404`, (done) => { 
        supertest(app)
            .get("/this/is/not/a/route/nor/will/it/ever/be")
            .expect(404, done)
    });
});