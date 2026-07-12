const supertest = require("supertest")

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
const mockEmit = jest.fn()
jest.mock("memory", () => ({
	client: () => require("./mockClient.js")(mockEmit, {
		timeout: () => ({
			emit: (event, ...args) => {
				const ack = args[args.length - 1]
				if(event == "listTask"){
					ack(null, {
						taskid1: {id: "taskid1", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: true},
						taskid2: {id: "taskid2", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: false}
					})
				}
				else{
					ack(new Error("operation has timed out"))
				}
			}
		})
	}),
	server: () => {}
}))

const app = require("../backend/schedule.js")
const { mockedPool } = require("pg")

describe("Memory ack timeout", () => {
	const cookieWithBearerToken = "validCookie"

	afterEach(() => {
		jest.clearAllMocks()
	})

	test("/memory/status returns 503 when memory does not ack instead of hanging forever", (done) => {
		supertest(app)
			.get("/memory/status")
			.set("Cookie", cookieWithBearerToken)
			.expect(503, { error: "memory unavailable" }, done)
	})

	test("/task/stop returns 503 when memory does not ack", (done) => {
		supertest(app)
			.post("/task/stop")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(503, { error: "memory unavailable" }, done)
	})

	test("/task/start rolls the inserted row back and returns 503 when memory does not ack the new cron", (done) => {
		supertest(app)
			.post("/task/start")
			.send({url: "/convert/createVideo", body: JSON.stringify({}), cronString: "*/10 * * * *"})
			.set("Cookie", cookieWithBearerToken)
			.expect(503, { error: "memory unavailable" }, (err) => {
				if(err) return done(err)
				expect(mockedPool.query).toHaveBeenCalledWith(
					"DELETE FROM scheduled_tasks WHERE id=$1",
					[expect.stringMatching(/^task-/)]
				)
				expect(mockEmit).toHaveBeenCalledWith("destroyTask", expect.stringMatching(/^task-/))
				done()
			})
	})

	test("/task/start returns 503 and emits a compensating stopTask when memory does not ack an existing cron start", (done) => {
		supertest(app)
			.post("/task/start")
			.send({id: "taskid2"})
			.set("Cookie", cookieWithBearerToken)
			.expect(503, { error: "memory unavailable" }, (err) => {
				if(err) return done(err)
				expect(mockEmit).toHaveBeenCalledWith("stopTask", "taskid2")
				done()
			})
	})

	test("/task/destroy returns 503 and keeps the DB row when memory does not ack", (done) => {
		supertest(app)
			.post("/task/destroy")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(503, { error: "memory unavailable" }, (err) => {
				if(err) return done(err)
				expect(mockedPool.query).not.toHaveBeenCalledWith(
					expect.stringContaining("DELETE FROM scheduled_tasks"),
					expect.anything()
				)
				done()
			})
	})
})
