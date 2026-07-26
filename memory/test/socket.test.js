let connect

const fakeClient = (id) => {
	const handlers = {}
	return { id, handlers, on: (event, fn) => { handlers[event] = fn } }
}

beforeEach(() => {
	jest.resetModules()
	process.env.memory_ON = "true"
	process.env.memory_PORT = "0"
	connect = null
	jest.doMock("socket.io", () => ({
		Server: jest.fn(() => ({
			on: (event, fn) => { if(event === "connection") connect = fn },
			close: jest.fn()
		}))
	}))
	require("../socket.js")()
})

describe("memory socket converter process wiring", () => {
	test("saveProcessEnder keys the ender by id so cancelProcess can run it", () => {
		const a = fakeClient("sockA")
		connect(a)
		const ender = jest.fn()
		a.handlers.saveProcessEnder("v1", ender)

		let msg
		a.handlers.cancelProcess("v1", "mp4", (m) => { msg = m })
		expect(ender).toHaveBeenCalledTimes(1)
		expect(msg).toBe("Your video (v1) was cancelled.")
	})

	test("a disconnect drops only the enders saved by that client", () => {
		const a = fakeClient("sockA")
		const b = fakeClient("sockB")
		connect(a)
		connect(b)
		const gone = jest.fn()
		const kept = jest.fn()
		a.handlers.saveProcessEnder("v1", gone)
		b.handlers.saveProcessEnder("v2", kept)

		a.handlers.disconnect()

		let goneMsg, keptMsg
		b.handlers.cancelProcess("v1", "mp4", (m) => { goneMsg = m })
		b.handlers.cancelProcess("v2", "zip", (m) => { keptMsg = m })
		expect(gone).not.toHaveBeenCalled()
		expect(goneMsg).toBe("not cancelled")
		expect(kept).toHaveBeenCalledTimes(1)
		expect(keptMsg).toBe("Your archive (v2) was cancelled.")
	})

	test("deleteProcessEnder releases the ack without cancelling", () => {
		const a = fakeClient("sockA")
		connect(a)
		const ender = jest.fn()
		a.handlers.saveProcessEnder("v1", ender)
		a.handlers.deleteProcessEnder("v1")

		let msg
		a.handlers.cancelProcess("v1", "mp4", (m) => { msg = m })
		expect(ender).toHaveBeenCalledTimes(1)
		expect(ender).toHaveBeenCalledWith(false)
		expect(msg).toBe("not cancelled")
	})
})
