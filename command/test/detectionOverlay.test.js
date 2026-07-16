const { contentViewBox } = require("../frontend/js/detections.js")

describe("contentViewBox", () => {
	test("crops all four padded sides", () => {
		expect(contentViewBox({ w: 416, h: 416 }, { top: 40, bot: 40, left: 10, right: 10 }))
			.toBe("10 40 396 336")
	})

	test("passes through with zero pad", () => {
		expect(contentViewBox({ w: 640, h: 360 }, { top: 0, bot: 0, left: 0, right: 0 }))
			.toBe("0 0 640 360")
	})

	test("defaults missing pad fields to zero", () => {
		expect(contentViewBox({ w: 416, h: 416 }, { top: 58, bot: 58 }))
			.toBe("0 58 416 300")
	})

	test("treats undefined pad as no crop", () => {
		expect(contentViewBox({ w: 100, h: 100 })).toBe("0 0 100 100")
	})
})
