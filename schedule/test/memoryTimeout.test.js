const TASKS = {
	taskid1: {id: "taskid1", url: "/convert/createVideo", cronString: "*/10 * * * *", body: {}, running: true},
	taskid2: {id: "taskid2", url: "/convert/createVideo", cronString: "*/10 * * * *", body: {}, running: false}
}

let timeoutEvents = []

const timeoutEmit = jest.fn((event, ...args) => {
	const ack = args[args.length - 1]
	setImmediate(() => {
		if (timeoutEvents.includes(event)) return ack(new Error("operation has timed out"))
		ack(null, TASKS)
	})
})

const mockClient = {
	timeout: jest.fn(() => ({ emit: timeoutEmit })),
	emit: jest.fn(),
	on: jest.fn(),
	off: jest.fn(),
	connected: true
}

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => mockClient,
	server: () => {}
}))

const supertest = require("supertest")
const app = require("../backend/schedule.js")

// Memory never acks. On develop these routes hung forever: the emits carried no
// ack timeout, so the response was never sent and the ack callback leaked.
describe("Task Routes when memory never acks", () => {
	afterEach(() => {
		jest.clearAllMocks()
		timeoutEvents = []
	})

	test("/task/list answers 503 instead of hanging", async () => {
		timeoutEvents = ["listTask"]
		const res = await supertest(app).get("/task/list").set("Cookie", "validCookie")
		expect(res.status).toBe(503)
		expect(res.body).toEqual({ error: "memory unavailable" })
	})

	test("/task/start answers 503 instead of hanging", async () => {
		timeoutEvents = ["listTask"]
		const res = await supertest(app)
			.post("/task/start")
			.set("Cookie", "validCookie")
			.send({ url: "/convert/createVideo", body: JSON.stringify({}), cronString: "*/10 * * * *" })
		expect(res.status).toBe(503)
	})

	test("/task/start restart branch answers 503 when startTask never acks", async () => {
		timeoutEvents = ["startTask"]
		const res = await supertest(app)
			.post("/task/start")
			.set("Cookie", "validCookie")
			.send({ id: "taskid2" })
		expect(timeoutEmit).toHaveBeenCalledWith("startTask", "taskid2", expect.any(Function))
		expect(res.status).toBe(503)
		expect(res.body).toEqual({ error: "memory unavailable" })
	})

	test("/task/stop answers 503 when stopTask never acks", async () => {
		timeoutEvents = ["stopTask"]
		const res = await supertest(app)
			.post("/task/stop")
			.set("Cookie", "validCookie")
			.send({ id: "taskid1" })
		expect(timeoutEmit).toHaveBeenCalledWith("stopTask", "taskid1", expect.any(Function))
		expect(res.status).toBe(503)
		expect(res.body).toEqual({ error: "memory unavailable" })
	})

	test("/task/destroy answers 503 when destroyTask never acks", async () => {
		timeoutEvents = ["destroyTask"]
		const res = await supertest(app)
			.post("/task/destroy")
			.set("Cookie", "validCookie")
			.send({ id: "taskid1" })
		expect(timeoutEmit).toHaveBeenCalledWith("destroyTask", "taskid1", expect.any(Function))
		expect(res.status).toBe(503)
		expect(res.body).toEqual({ error: "memory unavailable" })
	})

	test("/memory/status answers 503 instead of hanging", async () => {
		timeoutEvents = ["callback"]
		const res = await supertest(app).get("/memory/status").set("Cookie", "validCookie")
		expect(res.status).toBe(503)
		expect(res.body).toEqual({ error: "memory unavailable" })
	})

	test("asks memory through socket.io's own ack timeout rather than a bare emit", async () => {
		timeoutEvents = ["listTask"]
		await supertest(app).get("/task/list").set("Cookie", "validCookie")
		expect(mockClient.timeout).toHaveBeenCalledWith(2000)
		expect(timeoutEmit).toHaveBeenCalledWith("listTask", expect.any(Function))
		expect(mockClient.emit).not.toHaveBeenCalled()
	})
})
