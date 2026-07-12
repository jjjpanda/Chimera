const supertest = require("supertest")

let mockTask
const mockEmit = jest.fn((event, ...args) => {
	const ack = args[args.length - 1]
	if(typeof ack == "function"){
		ack({ taskid1: mockTask })
	}
})

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => require("./mockClient.js")(mockEmit),
	server: () => {}
}))

const app = require("../backend/schedule.js")
const { mockedPool } = require("pg")

describe("Task DB failure branches", () => {
	const cookieWithBearerToken = "validCookie"

	beforeEach(() => {
		mockTask = {id: "taskid1", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: false}
	})

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

	test("/task/start re-emits stopTask when the DB update fails, so the cron is not left running", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/start")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500)
			.end(() => {
				expect(mockEmit).toHaveBeenCalledWith("stopTask", "taskid1")
				done()
			})
	})

	test("/task/stop returns 500 on DB update failure", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/stop")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500, { error: "Failed to update task in DB" }, done)
	})

	test("/task/stop re-emits startTask when the DB update fails on a running task", (done) => {
		mockTask.running = true
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/stop")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500)
			.end(() => {
				expect(mockEmit).toHaveBeenCalledWith("startTask", "taskid1")
				done()
			})
	})

	test("/task/stop does not re-emit startTask when the task was already stopped", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/stop")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500)
			.end(() => {
				expect(mockEmit).not.toHaveBeenCalledWith("startTask", "taskid1")
				done()
			})
	})

	test("/task/destroy returns 500 on DB delete failure", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/destroy")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500, { error: "Failed to delete task from DB" }, done)
	})

	test("/task/destroy re-emits createTask when the DB delete fails, so the surviving row is not orphaned", (done) => {
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		supertest(app)
			.post("/task/destroy")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(500)
			.end(() => {
				expect(mockEmit).toHaveBeenCalledWith("createTask", mockTask)
				done()
			})
	})
})
