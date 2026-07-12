jest.mock("lib", () => ({
	...jest.requireActual("lib"),
	handleServerStart: jest.fn()
}))
jest.mock("pg")
jest.mock("memory")
jest.mock("axios")
jest.mock("../backend/lib/worker.js", () => ({
	startWorkers: jest.fn(),
	stopWorkers: jest.fn(),
	CAPTURES_DIR: ".",
	getStatus: () => ({}),
	cameras: jest.fn().mockResolvedValue([]),
	getConfig: () => ({}),
	setConfig: () => ({})
}))

const worker = require("../backend/lib/worker.js")
const { start } = require("../server.js")

describe("object server shutdown", () => {
	afterEach(() => {
		process.removeAllListeners("SIGINT")
		jest.clearAllMocks()
	})

	test("SIGINT stops the workers so their timers stop holding the event loop open", () => {
		process.env.object_ON = "true"
		start()
		process.emit("SIGINT")
		expect(worker.stopWorkers).toHaveBeenCalled()
	})

	test("no SIGINT handler is registered when object is off", () => {
		process.env.object_ON = "false"
		const before = process.listenerCount("SIGINT")
		start()
		expect(process.listenerCount("SIGINT")).toBe(before)
		expect(worker.stopWorkers).toHaveBeenCalled()
	})
})
