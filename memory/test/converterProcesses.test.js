const makeConverterProcesses = require("../lib/converterProcesses.js")

describe("converterProcesses", () => {
	test("cancelProcess runs the ender and removes it", () => {
		const { saveProcessEnder, cancelProcess } = makeConverterProcesses()
		const ender = jest.fn()
		saveProcessEnder("client1", "a", ender)
		let msg
		cancelProcess("a", "mp4", (m) => { msg = m })
		expect(ender).toHaveBeenCalledTimes(1)
		expect(msg).toBe("Your video (a) was cancelled.")
	})

	test("deleteProcessEnder removes the ender without running it", () => {
		const { saveProcessEnder, deleteProcessEnder, cancelProcess } = makeConverterProcesses()
		const ender = jest.fn()
		saveProcessEnder("client1", "b", ender)
		deleteProcessEnder("b")
		expect(ender).not.toHaveBeenCalled()
		let msg
		cancelProcess("b", "mp4", (m) => { msg = m })
		expect(ender).not.toHaveBeenCalled()
		expect(msg).toBe("not cancelled")
	})

	test("deleteClientProcesses drops only the disconnected client's enders", () => {
		const { saveProcessEnder, deleteClientProcesses, cancelProcess } = makeConverterProcesses()
		const dropped = jest.fn()
		const kept = jest.fn()
		saveProcessEnder("gone", "c", dropped)
		saveProcessEnder("alive", "d", kept)
		deleteClientProcesses("gone")

		let droppedMsg
		cancelProcess("c", "mp4", (m) => { droppedMsg = m })
		expect(dropped).not.toHaveBeenCalled()
		expect(droppedMsg).toBe("not cancelled")

		let keptMsg
		cancelProcess("d", "zip", (m) => { keptMsg = m })
		expect(kept).toHaveBeenCalledTimes(1)
		expect(keptMsg).toBe("Your archive (d) was cancelled.")
	})
})
