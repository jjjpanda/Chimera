jest.mock("pg", () => {
	const on = jest.fn()
	return { Pool: jest.fn(() => ({ on })), __on: on }
})

const createPool = require("../utils/createPool.js")
const { Pool, __on: on } = require("pg")

describe("createPool", () => {
	test("attaches an error listener even without a label", () => {
		createPool()
		expect(on).toHaveBeenCalledWith("error", expect.any(Function))
	})

	test("logs a default label when none is given", () => {
		createPool()
		const handler = on.mock.calls[0][1]
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
		const err = new Error("boom")
		handler(err)
		expect(logSpy).toHaveBeenCalledWith("POOL ERROR", err)
		logSpy.mockRestore()
	})

	test("logs the given label when provided, unchanged", () => {
		createPool("MY POOL ERROR")
		const handler = on.mock.calls[0][1]
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
		const err = new Error("boom")
		handler(err)
		expect(logSpy).toHaveBeenCalledWith("MY POOL ERROR", err)
		logSpy.mockRestore()
	})

	test("bounds the connect, and lets postgres abort a query before the client gives up on it", () => {
		createPool()
		const config = Pool.mock.calls[0][0]
		expect(config.connectionTimeoutMillis).toBe(5000)
		expect(config.statement_timeout).toBe(30000)
		expect(config.query_timeout).toBeGreaterThan(config.statement_timeout)
		expect(config.keepAlive).toBe(true)
		expect(config.keepAliveInitialDelayMillis).toBe(10000)
	})

	test("lets a caller override the timeouts for a long-running workload", () => {
		createPool("SWEEP", { max: 2, statement_timeout: 300000, query_timeout: 301000 })
		const config = Pool.mock.calls.at(-1)[0]
		expect(config.max).toBe(2)
		expect(config.statement_timeout).toBe(300000)
		expect(config.query_timeout).toBe(301000)
		expect(config.host).toBe(process.env.database_HOST)
	})
})
