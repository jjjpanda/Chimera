const makeConverterProcesses = require("../lib/converterProcesses.js")

describe("converterProcesses", () => {
	test("cancelProcess runs the ender and removes it", () => {
		const { saveProcessEnder, cancelProcess } = makeConverterProcesses()
		const ender = jest.fn()
		saveProcessEnder("a", ender)
		let msg
		cancelProcess("a", "mp4", (m) => { msg = m })
		expect(ender).toHaveBeenCalledTimes(1)
		expect(msg).toBe("Your video (a) was cancelled.")
	})

	test("deleteProcessEnder removes the ender without running it", () => {
		const { saveProcessEnder, deleteProcessEnder, cancelProcess } = makeConverterProcesses()
		const ender = jest.fn()
		saveProcessEnder("b", ender)
		deleteProcessEnder("b")
		expect(ender).not.toHaveBeenCalled()
		let msg
		cancelProcess("b", "mp4", (m) => { msg = m })
		expect(ender).not.toHaveBeenCalled()
		expect(msg).toBe("not cancelled")
	})
})
