jest.mock("pg", () => {
	const on = jest.fn()
	return { Pool: jest.fn(() => ({ on })), __on: on }
})

const createPool = require("../utils/createPool.js")
const { __on: on } = require("pg")

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
})
