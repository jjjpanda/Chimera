const timeoutEmit = jest.fn((event, ...args) => {
	const ack = args[args.length - 1]
	setImmediate(() => ack(new Error("operation has timed out")))
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
	})

	test("/task/list answers 503 instead of hanging", async () => {
		const res = await supertest(app).get("/task/list").set("Cookie", "validCookie")
		expect(res.status).toBe(503)
		expect(res.body).toEqual({ error: "memory unavailable" })
	})

	test("/task/start answers 503 instead of hanging", async () => {
		const res = await supertest(app)
			.post("/task/start")
			.set("Cookie", "validCookie")
			.send({ url: "/convert/createVideo", body: JSON.stringify({}), cronString: "*/10 * * * *" })
		expect(res.status).toBe(503)
	})

	test("asks memory through socket.io's own ack timeout rather than a bare emit", async () => {
		await supertest(app).get("/task/list").set("Cookie", "validCookie")
		expect(mockClient.timeout).toHaveBeenCalledWith(2000)
		expect(timeoutEmit).toHaveBeenCalledWith("listTask", expect.any(Function))
		expect(mockClient.emit).not.toHaveBeenCalled()
	})
})
