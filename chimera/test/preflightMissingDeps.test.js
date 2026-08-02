const EXITED = Symbol("process.exit")

const loadWithFailingRequire = (err) => {
	let thrown
	jest.isolateModules(() => {
		jest.doMock("../../lib/utils/loadCameras.js", () => { throw err })
		try {
			require("../preflight.js")
		} catch (e) {
			thrown = e
		}
	})
	if (thrown) throw thrown
}

describe("preflight missing dependencies", () => {
	test("exits 1 with a clear message when a util dependency is missing (MODULE_NOT_FOUND)", () => {
		const err = Object.assign(new Error("Cannot find module '../lib/utils/loadCameras.js'"), { code: "MODULE_NOT_FOUND" })
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = jest.spyOn(process, "exit").mockImplementation((code) => { throw Object.assign(new Error(EXITED.toString()), { code, [EXITED]: true }) })

		expect(() => loadWithFailingRequire(err)).toThrow()

		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("npm install"))

		errorSpy.mockRestore()
		exitSpy.mockRestore()
	})

	test("rethrows a non-MODULE_NOT_FOUND error instead of exiting", () => {
		const err = new Error("syntax error in loadCameras.js")

		expect(() => loadWithFailingRequire(err)).toThrow("syntax error in loadCameras.js")
	})
})
