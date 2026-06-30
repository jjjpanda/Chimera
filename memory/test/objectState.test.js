const { objectState } = require("lib")
const makeHandlers = require("../lib/objectState.js")

describe("memory objectScan handler", () => {
	test("wraps resolved detections as { detections }", async () => {
		const detections = [{ class: "car", score: 0.77, box: [0, 0, 1, 1] }]
		objectState.register({ scan: () => Promise.resolve(detections) })
		const result = await new Promise(res => makeHandlers().objectScan(3, res))
		expect(result).toEqual({ detections })
	})

	test("wraps a scan rejection as { error }", async () => {
		objectState.register({ scan: () => Promise.reject(new Error("frame grab failed")) })
		const result = await new Promise(res => makeHandlers().objectScan(3, res))
		expect(result).toEqual({ error: "frame grab failed" })
	})
})
