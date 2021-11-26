const supertest = require('supertest');
const app = require('../backend/command.js')

jest.mock('memory', () => ({
    client: (name) => ({
        emit: (event, ...args) => {
            if(event == "savePassword"){
                args[1]()
            }
            else if(event == "verifyPassword"){
                args[1](false)
            }
        },
        on: () => {}
    }),
    server: () => {}
}))

describe('Web App Routes', () => {
    const webAppRoutes = ["/", "/live/", "/process/", "/scrub/", "/stats/", "/login/"]
    for(const route of webAppRoutes){
        test(`Web app route ${route} responds with 200`, (done) => { 
            supertest(app)
                .get(route)
                .expect(200, done)
        });
    }

    test(`Nonexistent route responds with 404`, (done) => { 
        supertest(app)
            .get("/this/is/not/a/route/nor/will/it/ever/be")
            .expect(404, done)
    });
});