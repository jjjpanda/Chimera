const { previewMaxHeight, clampHeight } = require("../frontend/js/previewHeight.js")
const { padSlots } = require("../frontend/js/grid.js")

describe("clampHeight", () => {
	test("adds the drag delta to the start height", () => {
		expect(clampHeight(200, 50, 600)).toBe(250)
		expect(clampHeight(200, -30, 600)).toBe(170)
	})

	test("floors at 80", () => {
		expect(clampHeight(100, -500, 600)).toBe(80)
	})

	test("ceils at maxH", () => {
		expect(clampHeight(200, 5000, 600)).toBe(600)
	})
})

describe("previewMaxHeight", () => {
	test("takes the smaller of width- and height-derived caps", () => {
		expect(previewMaxHeight(1600, 900, 1)).toBe(Math.min(900, 600))
	})

	test("divides by the row count for grids", () => {
		expect(previewMaxHeight(1600, 900, 2)).toBe(300)
	})
})

describe("padSlots", () => {
	test("pads a short list with nulls up to four", () => {
		expect(padSlots([{ id: 1 }])).toEqual([{ id: 1 }, null, null, null])
	})

	test("keeps the first n when longer", () => {
		expect(padSlots([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4])
	})

	test("respects a custom length", () => {
		expect(padSlots([], 2)).toEqual([null, null])
	})
})
