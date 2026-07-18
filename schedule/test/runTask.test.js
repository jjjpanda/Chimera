const mockClient = {
	emit: jest.fn(),
	on: jest.fn(),
	off: jest.fn(),
	connected: true
}

const mockPost = jest.fn()

jest.mock("lib")
jest.mock("pg")
jest.mock("axios", () => ({
	default: { create: () => ({ post: mockPost }) }
}))
jest.mock("memory", () => ({
	client: () => mockClient,
	server: () => {}
}))

const { mockedPool } = require("pg")
const { registerTaskRunner } = require("../backend/routes/lib/scheduler.js")

const runner = () => {
	registerTaskRunner()
	return mockClient.on.mock.calls.find(([event]) => event == "runTask")[1]
}

describe("registerTaskRunner", () => {
	beforeEach(() => {
		process.env.storage_HOST = "storage.test"
		mockPost.mockResolvedValue({ data: {} })
		mockedPool.query.mockResolvedValue({})
	})

	afterEach(() => {
		delete process.env.storage_HOST
		jest.clearAllMocks()
	})

	test("keeps exactly one runTask listener so a cron tick fires a single POST", () => {
		registerTaskRunner()
		expect(mockClient.off).toHaveBeenCalledWith("runTask")
		expect(mockClient.on.mock.calls.filter(([event]) => event == "runTask")).toHaveLength(1)
	})

	test("posts the task url directly to storage and records the run", async () => {
		runner()({ id: "task-abc", url: "/file/pathClean", body: { camera: 1 } })
		await new Promise(process.nextTick)

		expect(mockPost).toHaveBeenCalledWith(
			"http://storage.test/file/pathClean",
			{ camera: 1 },
			expect.objectContaining({ headers: expect.any(Object) })
		)
		expect(mockedPool.query).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO task_runs"),
			["task-abc", "/file/pathClean"]
		)
	})

	test("refuses a url memory broadcast that is not schedulable", async () => {
		const { webhookAlert } = require("lib")
		runner()({ id: "task-evil", url: "/auth/createUser", body: {} })
		await new Promise(process.nextTick)

		expect(mockPost).not.toHaveBeenCalled()
		expect(webhookAlert).toHaveBeenCalledWith(expect.stringContaining("not schedulable"))
	})
})
