const mockClient = {
	emit: jest.fn((event, ...args) => {
		if(event == "destroyTask"){
			const ack = args[args.length - 1]
			if(typeof ack == "function") ack(null, {})
		}
	}),
	on: jest.fn(),
	off: jest.fn(),
	once: jest.fn(),
	connected: false
}
mockClient.timeout = jest.fn(() => ({ emit: mockClient.emit }))

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => mockClient,
	server: () => {}
}))

const { autoRegisterCleanup } = require("../backend/routes/lib/scheduler.js")

describe("autoRegisterCleanup", () => {
	beforeEach(() => {
		process.env.storage_ON = "true"
	})

	afterEach(() => {
		delete process.env.storage_MAX_GB
		delete process.env.storage_ON
		mockClient.connected = false
	})

	test("does nothing when storage_MAX_GB is unset", () => {
		delete process.env.storage_MAX_GB
		autoRegisterCleanup()
		expect(mockClient.emit).not.toHaveBeenCalled()
	})

	test("does nothing when storage is off", () => {
		process.env.storage_MAX_GB = "100"
		process.env.storage_ON = "false"
		mockClient.connected = true
		autoRegisterCleanup()
		expect(mockClient.emit).not.toHaveBeenCalled()
	})

	test("registers the cleanup task immediately when connected", () => {
		process.env.storage_MAX_GB = "100"
		mockClient.connected = true
		autoRegisterCleanup()
		expect(mockClient.emit).toHaveBeenCalledWith("destroyTask", "task-auto-cleanup", expect.any(Function))
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", {
			id: "task-auto-cleanup",
			url: "/file/pathAutoClean",
			body: {},
			cronString: "0 * * * *",
			running: true,
			protected: true
		})
	})

	test("defers registration until connect when not connected", () => {
		process.env.storage_MAX_GB = "100"
		mockClient.connected = false
		autoRegisterCleanup()
		expect(mockClient.emit).not.toHaveBeenCalled()
		expect(mockClient.on).toHaveBeenCalledWith("connect", expect.any(Function))

		const onConnect = mockClient.on.mock.calls.find(([event]) => event == "connect")[1]
		onConnect()
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-auto-cleanup" }))
	})

	test("registers the cleanup task even if destroyTask times out", () => {
		process.env.storage_MAX_GB = "100"
		mockClient.connected = true
		mockClient.emit.mockImplementationOnce((event, ...args) => {
			if(event == "destroyTask"){
				const ack = args[args.length - 1]
				if(typeof ack == "function") ack(new Error("operation has timed out"))
			}
		})
		autoRegisterCleanup()
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-auto-cleanup" }))
	})
})
