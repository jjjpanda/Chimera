let connect

const fakeClient = (id, ownerID) => {
	const handlers = {}
	return { id, handshake: { auth: { ownerID } }, handlers, on: (event, fn) => { handlers[event] = fn } }
}

beforeEach(() => {
	jest.resetModules()
	jest.useFakeTimers()
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

afterEach(() => {
	jest.useRealTimers()
})

describe("memory socket converter process wiring", () => {
	test("saveProcessEnder keys the ender by id so cancelProcess can run it", () => {
		const a = fakeClient("sockA", "ownerA")
		connect(a)
		const ender = jest.fn()
		a.handlers.saveProcessEnder("v1", ender)

		let msg
		a.handlers.cancelProcess("v1", "mp4", (m) => { msg = m })
		expect(ender).toHaveBeenCalledTimes(1)
		expect(msg).toBe("Your video (v1) was cancelled.")
	})

	test("a disconnect drops only the enders saved by that client once the grace period elapses", () => {
		const a = fakeClient("sockA", "ownerA")
		const b = fakeClient("sockB", "ownerB")
		connect(a)
		connect(b)
		const gone = jest.fn()
		const kept = jest.fn()
		a.handlers.saveProcessEnder("v1", gone)
		b.handlers.saveProcessEnder("v2", kept)

		a.handlers.disconnect()
		jest.advanceTimersByTime(10000)

		let goneMsg, keptMsg
		b.handlers.cancelProcess("v1", "mp4", (m) => { goneMsg = m })
		b.handlers.cancelProcess("v2", "zip", (m) => { keptMsg = m })
		expect(gone).not.toHaveBeenCalled()
		expect(goneMsg).toBe("not cancelled")
		expect(kept).toHaveBeenCalledTimes(1)
		expect(keptMsg).toBe("Your archive (v2) was cancelled.")
	})

	test("a reconnect under the same owner within the grace period keeps enders cancellable", () => {
		const a1 = fakeClient("sockA1", "ownerA")
		connect(a1)
		const ender = jest.fn()
		a1.handlers.saveProcessEnder("v1", ender)

		a1.handlers.disconnect()

		const a2 = fakeClient("sockA2", "ownerA")
		connect(a2)
		jest.advanceTimersByTime(10000)

		let msg
		a2.handlers.cancelProcess("v1", "mp4", (m) => { msg = m })
		expect(ender).toHaveBeenCalledWith(true)
		expect(msg).toBe("Your video (v1) was cancelled.")
	})

	test("deleteProcessEnder releases the ack without cancelling", () => {
		const a = fakeClient("sockA", "ownerA")
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
