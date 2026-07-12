const mockClient = {
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

// Memory never acks. On develop these routes hung forever: socket.io acks have no
// timeout, so the response was never sent and the ack callback leaked.
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

	test("the emit is left buffered, so socket.io still delivers it once memory is back", async () => {
		await supertest(app).get("/task/list").set("Cookie", "validCookie")
		expect(mockClient.emit).toHaveBeenCalledWith("listTask", expect.any(Function))
	})

	test("an ack arriving after the timeout does not send a second response", async () => {
		const res = await supertest(app).get("/task/list").set("Cookie", "validCookie")
		expect(res.status).toBe(503)

		const lateAck = mockClient.emit.mock.calls.find(([event]) => event == "listTask")[1]
		expect(() => lateAck({})).not.toThrow()
	})
})
