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
		process.env.gateway_HOST = "gateway.test"
		mockPost.mockResolvedValue({ data: {} })
		mockedPool.query.mockResolvedValue({})
	})

	afterEach(() => {
		delete process.env.gateway_HOST
		jest.clearAllMocks()
	})

	// develop registered one listener per task id, on whichever clustered schedule
	// instance served the create, while memory broadcast each tick to every
	// instance — so a task fired once per instance holding a listener.
	test("keeps exactly one runTask listener so a cron tick fires a single POST", () => {
		registerTaskRunner()
		expect(mockClient.off).toHaveBeenCalledWith("runTask")
		expect(mockClient.on.mock.calls.filter(([event]) => event == "runTask")).toHaveLength(1)
	})

	test("posts the task url through the gateway and records the run", async () => {
		runner()({ id: "task-abc", url: "/file/pathClean", body: { camera: 1 } })
		await new Promise(process.nextTick)

		expect(mockPost).toHaveBeenCalledWith(
			"https://gateway.test/file/pathClean",
			{ camera: 1 },
			expect.objectContaining({ headers: expect.any(Object) })
		)
		expect(mockedPool.query).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO task_runs"),
			["task-abc", "/file/pathClean"]
		)
	})

	test("ignores a tick for a url that is not schedulable", () => {
		runner()({ id: "task-abc", url: "/not/allowed", body: {} })
		expect(mockPost).not.toHaveBeenCalled()
	})

	test("ignores a malformed tick", () => {
		const run = runner()
		expect(() => run()).not.toThrow()
		expect(mockPost).not.toHaveBeenCalled()
	})
})
