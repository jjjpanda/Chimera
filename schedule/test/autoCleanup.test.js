const mockClient = {
	emit: jest.fn((event, ...args) => {
		if(event == "destroyTask"){
			const ack = args[args.length - 1]
			if(typeof ack == "function") ack()
		}
	}),
	on: jest.fn(),
	off: jest.fn(),
	once: jest.fn(),
	connected: false
}

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => mockClient,
	server: () => {}
}))

const { autoRegisterCleanup } = require("../backend/routes/lib/scheduler.js")

describe("autoRegisterCleanup", () => {
	afterEach(() => {
		delete process.env.storage_MAX_GB
		mockClient.connected = false
	})

	test("does nothing when storage_MAX_GB is unset", () => {
		delete process.env.storage_MAX_GB
		autoRegisterCleanup()
		expect(mockClient.emit).not.toHaveBeenCalled()
		expect(mockClient.once).not.toHaveBeenCalled()
	})

	test("registers the cleanup task immediately when connected", () => {
		process.env.storage_MAX_GB = "100"
		mockClient.connected = true
		autoRegisterCleanup()
		expect(mockClient.emit).toHaveBeenCalledWith("destroyTask", "task-auto-cleanup", expect.any(Function))
		expect(mockClient.off).toHaveBeenCalledWith("task-auto-cleanup")
		expect(mockClient.on).toHaveBeenCalledWith("task-auto-cleanup", expect.any(Function))
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", {
			id: "task-auto-cleanup",
			url: "/file/pathAutoClean",
			body: {},
			cronString: "0 * * * *",
			running: true
		})
	})

	test("defers registration until connect when not connected", () => {
		process.env.storage_MAX_GB = "100"
		mockClient.connected = false
		autoRegisterCleanup()
		expect(mockClient.emit).not.toHaveBeenCalled()
		expect(mockClient.once).toHaveBeenCalledWith("connect", expect.any(Function))

		const onConnect = mockClient.once.mock.calls.find(([event]) => event == "connect")[1]
		onConnect()
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-auto-cleanup" }))
		expect(mockClient.on).toHaveBeenCalledWith("task-auto-cleanup", expect.any(Function))
	})
})
