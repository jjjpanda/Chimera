const mockClient = {
	emit: jest.fn(),
	on: jest.fn(),
	off: jest.fn(),
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

const { rehydrateTasks, registerTaskRunner } = require("../backend/routes/lib/scheduler.js")
const { mockedPool } = require("pg")
const { webhookAlert } = require("lib")

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

	test("disables persisted tasks whose cron is invalid but still registers them so they stay listable", async () => {
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
		mockedPool.query.mockResolvedValueOnce({ rows: [
			{ id: "task-bad", url: "/file/pathClean", body: {}, cron_string: "not a cron", running: true },
			{ id: "task-ok", url: "/file/pathClean", body: {}, cron_string: "*/5 * * * *", running: true }
		] })
		mockedPool.query.mockResolvedValueOnce({ rows: [] })
		mockClient.connected = true
		await rehydrateTasks()

		expect(mockedPool.query).toHaveBeenCalledWith("UPDATE scheduled_tasks SET running=false WHERE id = ANY($1::text[])", [["task-bad"]])
		expect(mockedPool.query).not.toHaveBeenCalledWith(expect.stringContaining("DELETE FROM scheduled_tasks"), expect.anything())
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-ok", running: true }))
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-bad", running: false, disabled: true }))
		expect(mockClient.emit.mock.calls.find(([, task]) => task.id == "task-ok")[1].disabled).toBeUndefined()
		logSpy.mockRestore()
	})

	test("disables persisted tasks whose url is not schedulable but still registers them so they stay listable", async () => {
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
		mockedPool.query.mockResolvedValueOnce({ rows: [
			{ id: "task-bad-url", url: "/not/schedulable", body: {}, cron_string: "*/5 * * * *", running: true },
			{ id: "task-ok", url: "/file/pathClean", body: {}, cron_string: "*/5 * * * *", running: true }
		] })
		mockedPool.query.mockResolvedValueOnce({ rows: [] })
		mockClient.connected = true
		await rehydrateTasks()

		expect(mockedPool.query).toHaveBeenCalledWith("UPDATE scheduled_tasks SET running=false WHERE id = ANY($1::text[])", [["task-bad-url"]])
		expect(mockedPool.query).not.toHaveBeenCalledWith(expect.stringContaining("DELETE FROM scheduled_tasks"), expect.anything())
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-ok" }))
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-bad-url", running: false, disabled: true }))
		logSpy.mockRestore()
	})

	test("alerts once per disabled task instead of re-alerting on every memory reconnect", async () => {
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
		const rows = [{ id: "task-bad", url: "/file/pathClean", body: {}, cron_string: "not a cron", running: true }]
		mockedPool.query.mockResolvedValue({ rows })
		mockClient.connected = true
		await rehydrateTasks()

		const onConnect = mockClient.on.mock.calls.find(([event]) => event == "connect")[1]
		await onConnect()
		await onConnect()

		const alerts = webhookAlert.mock.calls.filter(([message]) => /task-bad/.test(message))
		expect(alerts).toHaveLength(1)
		expect(alerts[0][0]).not.toMatch(/can be fixed and restarted/)

		rows.push({ id: "task-bad-2", url: "/not/schedulable", body: {}, cron_string: "*/5 * * * *", running: true })
		await onConnect()

		expect(webhookAlert.mock.calls.filter(([message]) => /task-bad-2/.test(message))).toHaveLength(1)
		logSpy.mockRestore()
	})

	test("retries with backoff when the db query fails", async () => {
		jest.useFakeTimers()
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
		mockedPool.query.mockRejectedValueOnce(new Error("db down"))
		mockClient.connected = true
		await rehydrateTasks()
		expect(logSpy).toHaveBeenCalledWith("TASK REHYDRATE ERROR", expect.any(Error))
		expect(mockClient.emit).not.toHaveBeenCalled()

		mockedPool.query.mockResolvedValueOnce({ rows: [
			{ id: "task-abc", url: "/file/pathClean", body: {}, cron_string: "*/10 * * * *", running: true }
		] })
		await jest.advanceTimersByTimeAsync(2000)
		expect(mockClient.emit).toHaveBeenCalledWith("createTask", expect.objectContaining({ id: "task-abc" }))

		logSpy.mockRestore()
		jest.useRealTimers()
	})
})

describe("registerTaskRunner", () => {
	afterEach(() => jest.clearAllMocks())

	test("registers exactly one runTask listener", () => {
		registerTaskRunner()
		expect(mockClient.off).toHaveBeenCalledWith("runTask")
		expect(mockClient.on).toHaveBeenCalledWith("runTask", expect.any(Function))
	})
})
