const supertest = require("supertest")
const app = require("../backend/schedule.js")

const protectedTask = { id: "task-auto-cleanup", url: "/file/pathAutoClean", cronString: "0 * * * *", body: {}, running: true, protected: true }

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => ({
		emit: (event, ...args) => {
			if(event == "listTask"){
				args[0]({ "task-auto-cleanup": protectedTask })
			}
			else if(event == "stopTask" || event == "destroyTask"){
				args[1]({ "task-auto-cleanup": protectedTask })
			}
		},
		on: () => {},
		off: () => {}
	}),
	server: () => {}
}))

describe("Task Routes With Protected Task", () => {
	const cookieWithBearerToken = "validCookie"

	test("rejects stopping a protected task", (done) => {
		supertest(app)
			.post("/task/stop")
			.send({ id: "task-auto-cleanup" })
			.set("Cookie", cookieWithBearerToken)
			.expect(400, { error: "id invalid" }, done)
	})

	test("rejects destroying a protected task", (done) => {
		supertest(app)
			.post("/task/destroy")
			.send({ id: "task-auto-cleanup" })
			.set("Cookie", cookieWithBearerToken)
			.expect(400, { error: "id invalid" }, done)
	})
})
