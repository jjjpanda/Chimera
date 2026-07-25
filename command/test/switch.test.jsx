/** @jest-environment jsdom */

const React = require("react")
const { render, screen } = require("@testing-library/react")
const { Switch } = require("../frontend/components/ui/switch.jsx")

// mirrors the "Boxes" toggle in ClipMaker: an icon and a text node share the label with the switch
const renderBoxesToggle = (checked = false) => {
	const onCheckedChange = jest.fn()

	render(React.createElement("label", null,
		React.createElement("svg", { "data-testid": "icon" }),
		"Boxes",
		React.createElement(Switch, { checked, onCheckedChange })
	))

	return { onCheckedChange, toggle: screen.getByRole("switch") }
}

test("the label text supplies the accessible name", () => {
	renderBoxesToggle()

	expect(screen.getByRole("switch", { name: "Boxes" })).toBeTruthy()
})

test("aria-checked is false when the toggle is off", () => {
	expect(renderBoxesToggle(false).toggle.getAttribute("aria-checked")).toBe("false")
})

test("aria-checked is true when the toggle is on", () => {
	expect(renderBoxesToggle(true).toggle.getAttribute("aria-checked")).toBe("true")
})

test("activating the switch requests the opposite state", () => {
	const { toggle, onCheckedChange } = renderBoxesToggle(false)

	toggle.click()

	expect(onCheckedChange).toHaveBeenCalledWith(true)
})

test("clicking the label text forwards to the switch", () => {
	const { onCheckedChange } = renderBoxesToggle(true)

	screen.getByTestId("icon").closest("label").click()

	expect(onCheckedChange).toHaveBeenCalledWith(false)
})

test("the switch is a native button, so keyboard focus and activation work", () => {
	const { toggle } = renderBoxesToggle()

	toggle.focus()

	expect(toggle.tagName).toBe("BUTTON")
	expect(toggle.disabled).toBe(false)
	expect(document.activeElement).toBe(toggle)
})
