const EventEmitter = require("events")
const net = require("net")
const express = require("express")
const handleServerStart = require("../utils/handleServerStart.js")

describe("handleServerStart", () => {
	let exitSpy

	beforeEach(() => {
		exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {})
	})

	afterEach(() => {
		exitSpy.mockRestore()
	})

	test("forwards an async listen error (EADDRINUSE) to failureCallback and exits non-zero", (done) => {
		const blocker = express().listen(0, () => {
			const port = blocker.address().port
			handleServerStart(express(), port, () => {}, (err) => {
				expect(err).toBeDefined()
				expect(err.code).toBe("EADDRINUSE")
				// process.exit(1) runs right after this callback returns, so check on the next tick
				setImmediate(() => {
					expect(exitSpy).toHaveBeenCalledWith(1)
					blocker.close(done)
				})
			})
		})
	})

	test("exits non-zero on a listen error even when no failureCallback is supplied", () => {
		const server = new EventEmitter()
		server.close = () => {}
		const app = { listen: () => server }
		handleServerStart(app, 8080, () => {})
		expect(() => server.emit("error", new Error("boom"))).not.toThrow()
		expect(exitSpy).toHaveBeenCalledWith(1)
	})

	test("an out-of-range port fails over to failureCallback and exits non-zero instead of throwing ERR_SOCKET_BAD_PORT", () => {
		expect(() => new net.Server().listen("99999")).toThrow(/should be >= 0 and < 65536/)

		const app = { listen: jest.fn() }
		const failureCallback = jest.fn()

		expect(() => handleServerStart(app, "99999", () => {}, failureCallback)).not.toThrow()

		expect(app.listen).not.toHaveBeenCalled()
		expect(failureCallback).toHaveBeenCalledWith(expect.any(Error))
		expect(exitSpy).toHaveBeenCalledWith(1)
	})

	test.each([undefined, null, "", "  ", "abc", 0, -1, 65536, 8080.5])("rejects the invalid port %p without listening, and exits non-zero", (port) => {
		const app = { listen: jest.fn() }
		const failureCallback = jest.fn()

		handleServerStart(app, port, () => {}, failureCallback)

		expect(failureCallback).toHaveBeenCalledWith(expect.any(Error))
		expect(app.listen).not.toHaveBeenCalled()
		expect(exitSpy).toHaveBeenCalledWith(1)
	})

	test("listens on a numeric-string port", () => {
		const server = Object.assign(new EventEmitter(), { close: () => {} })
		const app = { listen: jest.fn().mockReturnValue(server) }

		handleServerStart(app, "8080", () => {}, jest.fn())

		expect(app.listen).toHaveBeenCalledWith(8080, expect.any(Function))
		expect(exitSpy).not.toHaveBeenCalled()
	})

	test("no failureCallback and an invalid port still exits non-zero without throwing", () => {
		expect(() => handleServerStart({ listen: jest.fn() }, "")).not.toThrow()
		expect(exitSpy).toHaveBeenCalledWith(1)
	})

	test("a runtime error after the server is already listening does not exit — only the boot-time bind failure should", () => {
		const server = Object.assign(new EventEmitter(), { listening: true, close: () => {} })
		const app = { listen: () => server }
		const failureCallback = jest.fn()

		handleServerStart(app, 8080, () => {}, failureCallback)
		const err = new Error("EMFILE, too many open files")
		err.code = "EMFILE"
		server.emit("error", err)

		expect(failureCallback).toHaveBeenCalledWith(err)
		expect(exitSpy).not.toHaveBeenCalled()
	})

	test("SIGINT closes the server and calls failureCallback without exiting — a clean shutdown is not a failure", () => {
		const onSpy = jest.spyOn(process, "on")
		const server = new EventEmitter()
		server.close = jest.fn()
		const app = { listen: () => server }
		const failureCallback = jest.fn()

		handleServerStart(app, 8080, () => {}, failureCallback)

		const sigintCall = onSpy.mock.calls.find(([event]) => event === "SIGINT")
		sigintCall[1]()

		expect(server.close).toHaveBeenCalled()
		expect(failureCallback).toHaveBeenCalledWith()
		expect(exitSpy).not.toHaveBeenCalled()

		onSpy.mockRestore()
	})
})
