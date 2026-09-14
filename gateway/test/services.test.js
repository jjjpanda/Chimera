const services = require("../services.js")

describe("Gateway Services Configuration", () => {
	test("storage service includes putPathRegex matching motion routes", () => {
		const storageService = services.find((s) => s.log.includes("Storage"))
		expect(storageService).toBeDefined()
		expect(storageService.putPathRegex).toBeDefined()
		expect(storageService.putPathRegex.test("/motion/sensitivity")).toBe(true)
		expect(storageService.putPathRegex.test("/motion/anything")).toBe(true)
		expect(storageService.putPathRegex.test("/command/anything")).toBe(false)
	})
})
