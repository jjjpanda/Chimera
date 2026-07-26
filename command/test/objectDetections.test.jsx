/** @jest-environment jsdom */

// Radix's Slider Thumb measures itself via ResizeObserver, which jsdom doesn't implement
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

jest.mock("../frontend/hooks/useObjectDetections.js", () => ({
	__esModule: true,
	default: () => ({
		status: { cameras: { 1: {} } },
		detections: [
			{ image: "a.jpg", camera: 1, timestamp: "2024-01-01T00:00:00Z", box: [1] },
			{ image: "b.jpg", camera: 1, timestamp: "2024-01-01T00:01:00Z", box: [1] },
			{ image: "c.jpg", camera: 1, timestamp: "2024-01-01T00:02:00Z", box: [1] }
		],
		loadStatus: () => {},
		loadDetections: () => {},
		scan: () => {}
	})
}))

const React = require("react")
const { render, screen, act, fireEvent } = require("@testing-library/react")
const { MemoryRouter } = require("react-router-dom")
const ObjectDetections = require("../frontend/app/ObjectDetections.jsx").default

const renderFull = () => {
	const future = { v7_startTransition: true, v7_relativeSplatPath: true }
	return render(React.createElement(MemoryRouter, { future }, React.createElement(ObjectDetections)))
}

test("scrub slider forwards its aria-label to the Radix thumb and steps by keyboard", async () => {
	renderFull()

	await act(async () => { screen.getByText("Camera 1").click() })

	const thumb = screen.getByRole("slider", { name: "Scrub detections" })
	expect(screen.getByText("3 / 3")).toBeTruthy()

	fireEvent.keyDown(thumb, { key: "ArrowLeft" })
	expect(screen.getByText("2 / 3")).toBeTruthy()
})
