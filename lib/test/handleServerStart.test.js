const EventEmitter = require("events")
const net = require("net")
const express = require("express")
const handleServerStart = require("../utils/handleServerStart.js")

describe("handleServerStart", () => {
	test("forwards an async listen error (EADDRINUSE) to failureCallback", (done) => {
		const blocker = express().listen(0, () => {
			const port = blocker.address().port
			handleServerStart(express(), port, () => {}, (err) => {
				expect(err).toBeDefined()
				expect(err.code).toBe("EADDRINUSE")
				blocker.close(done)
			})
		})
	})

	test("ignores a listen error when no failureCallback is supplied", () => {
		const server = new EventEmitter()
		server.close = () => {}
		const app = { listen: () => server }
		handleServerStart(app, 8080, () => {})
		expect(() => server.emit("error", new Error("boom"))).not.toThrow()
	})

	test("an out-of-range port fails over to failureCallback instead of throwing ERR_SOCKET_BAD_PORT", () => {
		expect(() => new net.Server().listen("99999")).toThrow(/should be >= 0 and < 65536/)

		const app = { listen: jest.fn() }
		const failureCallback = jest.fn()

		expect(() => handleServerStart(app, "99999", () => {}, failureCallback)).not.toThrow()

		expect(app.listen).not.toHaveBeenCalled()
		expect(failureCallback).toHaveBeenCalledWith(expect.any(Error))
	})

	test.each([undefined, null, "", "  ", "abc", 0, -1, 65536, 8080.5])("rejects the invalid port %p without listening", (port) => {
		const app = { listen: jest.fn() }
		const failureCallback = jest.fn()

		handleServerStart(app, port, () => {}, failureCallback)

		expect(failureCallback).toHaveBeenCalledWith(expect.any(Error))
		expect(app.listen).not.toHaveBeenCalled()
	})

	test("listens on a numeric-string port", () => {
		const server = Object.assign(new EventEmitter(), { close: () => {} })
		const app = { listen: jest.fn().mockReturnValue(server) }

		handleServerStart(app, "8080", () => {}, jest.fn())

		expect(app.listen).toHaveBeenCalledWith(8080, expect.any(Function))
	})

	test("no failureCallback and an invalid port is still not a throw", () => {
		expect(() => handleServerStart({ listen: jest.fn() }, "")).not.toThrow()
	})
})
