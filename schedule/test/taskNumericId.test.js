const supertest = require("supertest")
const app = require("../backend/schedule.js")

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => ({
		timeout() { return this },
		emit: (event, ...args) => {
			if(event == "listTask"){
				args[0](null, {
					taskid1: {id: "taskid1", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: true}
				})
			}
		},
		on: () => {},
		off: () => {}
	}),
	server: () => {}
}))

describe("Task routes given a numeric id", () => {
	const cookieWithBearerToken = "validCookie"

	test("/task/stop does not crash and returns id invalid", (done) => {
		supertest(app)
			.post("/task/stop")
			.send({id: 5})
			.set("Cookie", cookieWithBearerToken)
			.expect(400, { error: "id invalid" }, done)
	})

	test("/task/destroy does not crash and returns id invalid", (done) => {
		supertest(app)
			.post("/task/destroy")
			.send({id: 5})
			.set("Cookie", cookieWithBearerToken)
			.expect(400, { error: "id invalid" }, done)
	})

	test("/task/start with a numeric id does not crash", (done) => {
		supertest(app)
			.post("/task/start")
			.send({id: 5, url: "/convert/createVideo", body: JSON.stringify({}), cronString: "*/10 * * * *"})
			.set("Cookie", cookieWithBearerToken)
			.expect(200, { running: true }, done)
	})
})
