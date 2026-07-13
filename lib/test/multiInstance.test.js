const os = require("os")
const { multiInstance, validInstances, instanceCount } = require("../utils/multiInstance.js")

describe("multiInstance", () => {
	test.each([
		["max", true], ["0", true], ["-1", true], ["4", true], [" 3 ", true],
		["1", false], ["", false], [undefined, false], ["lots", false], ["2.5", false],
		["-2", false], ["-8", false], ["1e3", false], ["0x10", false]
	])("%s -> %s", (val, expected) => {
		expect(multiInstance(val)).toBe(expected)
	})
})

describe("validInstances", () => {
	test.each([
		["max", true], ["0", true], ["-1", true], ["1", true], ["4", true], [" 3 ", true],
		["", false], [undefined, false], ["lots", false], ["2.5", false], ["4x", false],
		["-2", false], ["1e3", false], ["0x10", false], ["+2", false]
	])("%s -> %s", (val, expected) => {
		expect(validInstances(val)).toBe(expected)
	})
})

describe("instanceCount", () => {
	const cpus = os.cpus().length

	test.each([
		["max", cpus], ["0", cpus], ["-1", Math.max(1, cpus - 1)], ["4", 4],
		["", 1], [undefined, 1], ["lots", 1]
	])("%s -> %s", (val, expected) => {
		expect(instanceCount(val)).toBe(expected)
	})
})
