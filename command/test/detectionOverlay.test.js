/** @jest-environment jsdom */

const FRAME = { w: 416, h: 416 }
const PAD = { top: 0, bot: 182, left: 0, right: 0 }

jest.mock("../frontend/js/letterbox.js", () => ({
	__esModule: true,
	detectGrayPad: jest.fn(() => PAD)
}))

jest.mock("../frontend/hooks/useObjectDetections.js", () => ({
	__esModule: true,
	default: () => ({
		status: { cameraNames: { 1: "front" } },
		detections: [{ image: "a.jpg", camera: 1, timestamp: "2024-01-01T00:00:00Z", box: [10, 10, 50, 50], type: "person", confidence: 0.9 }],
		loadStatus: () => {},
		loadDetections: () => {},
		scan: () => {}
	})
}))

const React = require("react")
const { render, fireEvent } = require("@testing-library/react")
const { MemoryRouter } = require("react-router-dom")
const { contentViewBox } = require("../frontend/js/detections.js")
const { detectGrayPad } = require("../frontend/js/letterbox.js")
const ObjectDetections = require("../frontend/app/ObjectDetections.jsx").default

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

describe("mini thumbnail overlay", () => {
	const coverScale = (cell, src) => Math.max(cell.w / src.w, cell.h / src.h)

	const renderMini = () => {
		const future = { v7_startTransition: true, v7_relativeSplatPath: true }
		const { container } = render(React.createElement(MemoryRouter, { future },
			React.createElement(ObjectDetections, { mini: true })))
		const img = container.querySelector("img")
		Object.defineProperty(img, "naturalWidth", { value: FRAME.w })
		Object.defineProperty(img, "naturalHeight", { value: FRAME.h })
		fireEvent.load(img)
		return { img, svg: img.parentElement.querySelector("svg") }
	}

	test.each([
		["square", { w: 200, h: 200 }],
		["1.65 aspect", { w: 264, h: 160 }]
	])("image and overlay cover a %s cell from the same source rect", (_label, cell) => {
		const { img, svg } = renderMini()
		const [, , vbW, vbH] = svg.getAttribute("viewBox").split(" ").map(Number)

		expect(detectGrayPad).toHaveBeenCalled()
		expect(img.className).toContain("object-cover")

		expect(coverScale(cell, { w: vbW, h: vbH }))
			.toBeCloseTo(coverScale(cell, { w: img.naturalWidth, h: img.naturalHeight }), 6)
	})
})
