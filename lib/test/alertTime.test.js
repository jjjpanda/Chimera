const alertTime = require("../utils/alertTime.js")

describe("alertTime", () => {
	const orig = process.env.alert_TZ
	afterEach(() => { orig === undefined ? delete process.env.alert_TZ : process.env.alert_TZ = orig })

	test("parses input as UTC and converts to alert_TZ", () => {
		process.env.alert_TZ = "America/New_York"
		const m = alertTime("20210701-120000", "YYYYMMDD-HHmmss")
		expect(m.format("YYYY-MM-DD HH:mm")).toBe("2021-07-01 08:00")
		expect(m.clone().utc().format("YYYYMMDD-HHmmss")).toBe("20210701-120000")
	})

	test("defaults to UTC when alert_TZ is unset", () => {
		delete process.env.alert_TZ
		const m = alertTime("20210701-120000", "YYYYMMDD-HHmmss")
		expect(m.format("YYYY-MM-DD HH:mm")).toBe("2021-07-01 12:00")
		expect(m.format("z")).toBe("UTC")
	})

	test("returns current time in alert_TZ when no input", () => {
		process.env.alert_TZ = "America/New_York"
		const m = alertTime()
		expect(m.tz()).toBe("America/New_York")
		expect(Math.abs(m.valueOf() - Date.now())).toBeLessThan(5000)
	})
})
