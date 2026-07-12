const mockPost = jest.fn()
const mockClient = {
	emit: jest.fn(),
	on: jest.fn(),
	off: jest.fn(),
	connected: true
}
mockClient.timeout = jest.fn(() => ({ emit: mockClient.emit }))

jest.mock("lib")
jest.mock("pg")
jest.mock("axios", () => ({ default: { create: () => ({ post: mockPost }) } }))
jest.mock("memory", () => ({
	client: () => mockClient,
	server: () => {}
}))

const { registerTaskRunner } = require("../backend/routes/lib/scheduler.js")
const { mockedPool } = require("pg")
const { schedulableUrls, gatewayHost } = require("lib")

const URL = schedulableUrls[0]
const flush = () => new Promise((resolve) => setImmediate(resolve))

const getRunTask = () => {
	registerTaskRunner()
	return mockClient.on.mock.calls.find(([event]) => event == "runTask")[1]
}

describe("runTask", () => {
	let logSpy

	beforeEach(() => {
		process.env.scheduler_AUTH = "scheduler-auth"
		logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		logSpy.mockRestore()
		jest.clearAllMocks()
	})

	test("posts to the gateway with a scheme-qualified url and records a successful run", async () => {
		mockPost.mockResolvedValueOnce({ data: { ok: true } })

		getRunTask()({ id: "task-abc", url: URL, body: { a: 1 } })
		await flush()

		expect(mockPost).toHaveBeenCalledWith(`${gatewayHost()}${URL}`, { a: 1 }, {
			headers: { "Authorization": "scheduler-auth" }
		})
		expect(mockPost.mock.calls[0][0]).toMatch(/^https?:\/\//)
		expect(mockedPool.query).toHaveBeenCalledWith(
			"INSERT INTO task_runs (task_id, url, status, http_status) VALUES ($1, $2, 'success', 200)",
			["task-abc", URL]
		)
	})

	test("records a failed run with the response status and error message", async () => {
		mockPost.mockRejectedValueOnce({ response: { status: 500 }, message: "boom" })

		getRunTask()({ id: "task-abc", url: URL, body: {} })
		await flush()

		expect(mockedPool.query).toHaveBeenCalledWith(
			"INSERT INTO task_runs (task_id, url, status, http_status, error) VALUES ($1, $2, 'failure', $3, $4)",
			["task-abc", URL, 500, "boom"]
		)
	})

	test("records a failed run with a null http status when the request never reached the gateway", async () => {
		mockPost.mockRejectedValueOnce({ message: "ECONNREFUSED" })

		getRunTask()({ id: "task-abc", url: URL, body: {} })
		await flush()

		expect(mockedPool.query).toHaveBeenCalledWith(
			expect.stringContaining("'failure'"),
			["task-abc", URL, null, "ECONNREFUSED"]
		)
	})

	test("refuses to run a url that is not schedulable", async () => {
		const runTask = getRunTask()

		runTask({ id: "task-abc", url: "/not/schedulable", body: {} })
		runTask({ id: "task-abc" })
		runTask()
		await flush()

		expect(mockPost).not.toHaveBeenCalled()
		expect(mockedPool.query).not.toHaveBeenCalled()
	})
})
