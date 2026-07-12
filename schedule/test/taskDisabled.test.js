const supertest = require("supertest")
const app = require("../backend/schedule.js")

const disabledTask = {id: "taskid1", url: "/not/schedulable", cronString: "not a cron", body: {}, running: false, disabled: true}
const liveTask = {id: "taskid2", url: "/task/url", cronString: "*/10 * * * *", body: {}, running: false}

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => require("./mockClient.js")((event, ...args) => {
		if(event == "listTask"){
			args[0]({ taskid1: disabledTask, taskid2: liveTask })
		}
		else if(event == "startTask"){
			args[1]({ taskid1: disabledTask, taskid2: {...liveTask, running: true} })
		}
		else if(event == "destroyTask"){
			args[1]({ taskid2: liveTask })
		}
	}),
	server: () => {}
}))

describe("Task Routes With A Disabled Task", () => {
	const cookieWithBearerToken = "validCookie"

	test("/task/list marks the disabled task so it is not presented as startable", (done) => {
		supertest(app)
			.get("/task/list")
			.set("Cookie", cookieWithBearerToken)
			.expect(200, { tasks: [disabledTask, liveTask] }, done)
	})

	test("/task/start refuses a disabled task instead of scheduling a cron that can never fire", (done) => {
		supertest(app)
			.post("/task/start")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(400, { error: "task disabled" }, done)
	})

	test("/task/start still starts a stopped task that is not disabled", (done) => {
		supertest(app)
			.post("/task/start")
			.send({id: "taskid2"})
			.set("Cookie", cookieWithBearerToken)
			.expect(200, { running: true }, done)
	})

	test("/task/destroy removes a disabled task so it can be cleaned up", (done) => {
		supertest(app)
			.post("/task/destroy")
			.send({id: "taskid1"})
			.set("Cookie", cookieWithBearerToken)
			.expect(200, { destroyed: true }, done)
	})
})
