/** @jest-environment jsdom */

const React = require("react")
const { render, screen } = require("@testing-library/react")
const CameraGridMini = require("../frontend/components/CameraGridMini.jsx").default

const renderGrid = (overrides = {}) => {
	const onActivate = jest.fn()
	const onCellClick = jest.fn()
	const slots = [{ id: 1, name: "indoor" }, null, null, null]

	render(React.createElement(CameraGridMini, {
		slots,
		renderCell: (slot) => React.createElement("span", null, slot.name),
		cellLabel: (slot) => slot.name,
		onCellClick,
		onActivate,
		centerIcon: React.createElement("svg", { "data-testid": "center-icon" }),
		activateLabel: "Open clip maker",
		...overrides
	}))

	return { onActivate, onCellClick }
}

test("clicking a camera cell calls onCellClick but not onActivate", () => {
	const { onActivate, onCellClick } = renderGrid()

	screen.getByLabelText("indoor").click()

	expect(onCellClick).toHaveBeenCalledWith({ id: 1, name: "indoor" })
	expect(onActivate).not.toHaveBeenCalled()
})

test("clicking the center button calls onActivate but not onCellClick", () => {
	const { onActivate, onCellClick } = renderGrid()

	screen.getByLabelText("Open clip maker").click()

	expect(onActivate).toHaveBeenCalledTimes(1)
	expect(onCellClick).not.toHaveBeenCalled()
})

test("clicking the card background outside any button calls onActivate", () => {
	const { onActivate } = renderGrid()

	screen.getByTestId("center-icon").closest(".cursor-pointer.select-none").click()

	expect(onActivate).toHaveBeenCalledTimes(1)
})

test("falls back to a generic label when cellLabel returns null", () => {
	renderGrid({ cellLabel: () => null })

	expect(screen.getByLabelText("Open camera")).toBeTruthy()
})

test("empty slots render no cell button", () => {
	renderGrid()

	expect(screen.getAllByRole("button")).toHaveLength(2)
})
