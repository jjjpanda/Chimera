const mockClient = {
	emit: jest.fn(),
	on: jest.fn(),
	off: jest.fn(),
	connected: false
}

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => mockClient,
	server: () => {}
}))

const { rehydrateTasks } = require("../backend/routes/lib/scheduler.js")
const { mockedPool } = require("pg")

describe("rehydrateTasks", () => {
	afterEach(() => {
		mockClient.connected = false
		jest.clearAllMocks()
	})

	test("registers connect listener regardless of current connection state", () => {
		rehydrateTasks()
		expect(mockClient.on).toHaveBeenCalledWith("connect", expect.any(Function))
	})

	test("recreates crons for every persisted task when already connected", async () => {
		mockedPool.query.mockResolvedValueOnce({ rows: [
			{ id: "task-abc", url: "/file/pathClean", body: {}, cron_string: "*/10 * * * *", running: true },
			{ id: "task-def", url: "/file/pathClean", body: {}, cron_string: "*/5 * * * *", running: false }
		] })
		mockClient.connected = true
		await rehydrateTasks()

		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-abc", running: true }))
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-def", running: false }))
	})

	test("defers rehydration until connect when not yet connected", async () => {
		mockClient.connected = false
		rehydrateTasks()
		expect(mockClient.emit).not.toHaveBeenCalled()

		const onConnect = mockClient.on.mock.calls.find(([event]) => event == "connect")[1]
		mockedPool.query.mockResolvedValueOnce({ rows: [
			{ id: "task-abc", url: "/file/pathClean", body: {}, cron_string: "*/10 * * * *", running: true }
		] })
		await onConnect()
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-abc" }))
	})

	test("logs and stops when the db query fails", async () => {
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		mockClient.connected = true
		await rehydrateTasks()
		expect(logSpy).toHaveBeenCalledWith("TASK REHYDRATE ERROR", expect.any(Error))
		expect(mockClient.emit).not.toHaveBeenCalled()
		logSpy.mockRestore()
	})
})
