const request = require('supertest');
const app = require('../backend/command.js')

describe('Web App Routes', () => {
    const webAppRoutes = ["/", "/live/", "/process/", "/scrub/", "/stats/", "/login/"]
    for(const route of webAppRoutes){
        test(`Web app route ${route} responds with 200`, (done) => { 
            request(app)
                .get(route)
                .expect(200, done)
        });
    }

    test(`Nonexistent route responds with 404`, (done) => { 
        request(app)
            .get("/this/is/not/a/route/nor/will/it/ever/be")
            .expect(404, done)
    });
});