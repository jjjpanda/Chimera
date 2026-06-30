const EventEmitter = require("events")
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
		handleServerStart(app, 0, () => {})
		expect(() => server.emit("error", new Error("boom"))).not.toThrow()
	})
})
