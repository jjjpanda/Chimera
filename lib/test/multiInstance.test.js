const multiInstance = require("../utils/multiInstance.js")

describe("multiInstance", () => {
	test.each([
		["max", true], ["0", true], ["-1", true], ["4", true], [" 3 ", true],
		["1", false], ["", false], [undefined, false], ["lots", false], ["2.5", false],
		["-2", false], ["-8", false]
	])("%s -> %s", (val, expected) => {
		expect(multiInstance(val)).toBe(expected)
	})
})
