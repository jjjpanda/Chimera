const supertest = require("supertest")

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => ({
		timeout() { return this },
		emit: (event, ...args) => {
			if(event == "listTask"){
				args[0](null, {
					taskid1: {id: "taskid1", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: false}
				})
			}
		},
		on: () => {},
		off: () => {}
	}),
	server: () => {}
}))

const app = require("../backend/schedule.js")
const { mockedPool } = require("pg")

describe("Task DB failure branches", () => {
	const cookieWithBearerToken = "validCookie"

	afterEach(() => {
		jest.clearAllMocks()
	})

	test("/task/start restarting an existing stopped task returns 500 on DB update failure", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/start")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500, { error: "Failed to update task in DB" }, done)
	})

	test("/task/start creating a new task returns 500 on DB insert failure", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/start")
			.send({url: "/convert/createVideo", body: JSON.stringify({}), cronString: "*/10 * * * *"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500, { error: "Failed to insert task into DB" }, done)
	})

	test("/task/stop returns 500 on DB update failure", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/stop")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500, { error: "Failed to update task in DB" }, done)
	})

	test("/task/destroy returns 500 on DB delete failure", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/destroy")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500, { error: "Failed to delete task from DB" }, done)
	})
})
