const { parse, nms } = require("../backend/lib/detector.js")

// 84 anchors -> derived input size 64 (grids 8 + 4 + 2 for strides 8/16/32)
const CHANNELS = 85
const ANCHORS = 84

const makeOutput = (entries) => {
	const data = new Float32Array(ANCHORS * CHANNELS)
	for (const { anchor, box, obj, cls, clsScore } of entries) {
		const o = anchor * CHANNELS
		data[o] = box[0]
		data[o + 1] = box[1]
		data[o + 2] = box[2]
		data[o + 3] = box[3]
		data[o + 4] = obj
		data[o + 5 + cls] = clsScore
	}
	return { data, dims: [1, ANCHORS, CHANNELS] }
}

describe("Detector parsing (YOLOX grid decode)", () => {
	test("decodes a person detection at stride-8 grid origin", () => {
		const output = makeOutput([{ anchor: 0, box: [0, 0, 0, 0], obj: 0.9, cls: 0, clsScore: 0.95 }])
		const result = parse(output, 0.5)
		expect(result).toHaveLength(1)
		expect(result[0].class).toBe("person")
		expect(result[0].score).toBeCloseTo(0.855)
		// cx=(0+0)*8=0, cy=0, w=exp(0)*8=8, h=8 -> [cx-w/2, cy-h/2, w, h]
		expect(result[0].box).toEqual([-4, -4, 8, 8])
	})

	test("scores are objectness x class confidence", () => {
		const output = makeOutput([{ anchor: 1, box: [0, 0, 0, 0], obj: 0.5, cls: 2, clsScore: 0.8 }])
		const result = parse(output, 0.3)
		expect(result).toHaveLength(1)
		expect(result[0].class).toBe("car")
		expect(result[0].score).toBeCloseTo(0.4)
	})

	test("filters detections below the confidence threshold", () => {
		const output = makeOutput([{ anchor: 0, box: [0, 0, 0, 0], obj: 0.5, cls: 0, clsScore: 0.5 }])
		expect(parse(output, 0.5)).toHaveLength(0)
	})
})

describe("Non-max suppression", () => {
	test("drops overlapping boxes of the same class, keeps the strongest", () => {
		const boxes = [
			{ class: "person", score: 0.9, box: [0, 0, 10, 10] },
			{ class: "person", score: 0.6, box: [1, 1, 10, 10] },
			{ class: "person", score: 0.8, box: [100, 100, 10, 10] }
		]
		const result = nms(boxes)
		expect(result).toHaveLength(2)
		expect(result[0].score).toBe(0.9)
		expect(result[1].score).toBe(0.8)
	})

	test("keeps overlapping boxes of different classes", () => {
		const boxes = [
			{ class: "person", score: 0.9, box: [0, 0, 10, 10] },
			{ class: "dog", score: 0.85, box: [0, 0, 10, 10] }
		]
		expect(nms(boxes)).toHaveLength(2)
	})
})
