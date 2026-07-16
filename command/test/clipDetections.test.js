const { nearestFrameIndex, frameSpacingMs, boxesForScrub, fuseMarkers } = require("../frontend/js/detections.js")
const { gridShape } = require("../frontend/js/grid.js")

describe("nearestFrameIndex", () => {
	test("returns the index of the closest time", () => {
		expect(nearestFrameIndex([0, 100, 200], 130)).toBe(1)
		expect(nearestFrameIndex([0, 100, 200], 170)).toBe(2)
	})

	test("skips null times", () => {
		expect(nearestFrameIndex([null, 100, null], 5000)).toBe(1)
	})

	test("defaults to 0 when all null or empty", () => {
		expect(nearestFrameIndex([null, null], 5)).toBe(0)
		expect(nearestFrameIndex([], 5)).toBe(0)
	})
})

describe("frameSpacingMs", () => {
	test("even spacing", () => {
		expect(frameSpacingMs([0, 100, 200, 300])).toBe(100)
	})

	test("infinite for one or fewer distinct times", () => {
		expect(frameSpacingMs([500])).toBe(Infinity)
		expect(frameSpacingMs([null, null])).toBe(Infinity)
		expect(frameSpacingMs([200, 200])).toBe(Infinity)
	})
})

describe("boxesForScrub", () => {
	const det = (image, ms) => ({ image, timestamp: new Date(ms).toISOString(), box: [0, 0, 1, 1], type: "person", confidence: 0.9 })

	test("returns boxes of the image nearest the scrub frame, within tolerance", () => {
		const dets = [det("a", 0), det("a", 10), det("b", 1000)]
		expect(boxesForScrub(dets, [0, 1000], 0, 100).map(d => d.image)).toEqual(["a", "a"])
	})

	test("excludes detections beyond tolerance", () => {
		expect(boxesForScrub([det("a", 0)], [1000], 0, 100)).toEqual([])
	})

	test("a detection only shows on its nearest frame, not adjacent ones", () => {
		const dets = [det("a", 60)]
		expect(boxesForScrub(dets, [0, 100, 200], 1, 100).map(d => d.image)).toEqual(["a"])
		expect(boxesForScrub(dets, [0, 100, 200], 0, 100)).toEqual([])
	})

	test("a null frame time yields nothing", () => {
		expect(boxesForScrub([det("a", 0)], [null, 100], 0, 100)).toEqual([])
	})
})

describe("fuseMarkers", () => {
	test("fuses near ticks into a band, keeps far ones separate", () => {
		expect(fuseMarkers([10, 11, 50], 1.5)).toEqual([{ start: 10, end: 11 }, { start: 50, end: 50 }])
	})

	test("empty in, empty out", () => {
		expect(fuseMarkers([], 1.5)).toEqual([])
	})
})

describe("gridShape", () => {
	test("one camera is a single cell", () => {
		expect(gridShape(1)).toEqual({ cols: 1, rows: 1 })
	})

	test("two cameras are one row", () => {
		expect(gridShape(2)).toEqual({ cols: 2, rows: 1 })
	})

	test("three or four cameras fill a 2x2", () => {
		expect(gridShape(3)).toEqual({ cols: 2, rows: 2 })
		expect(gridShape(4)).toEqual({ cols: 2, rows: 2 })
	})
})
