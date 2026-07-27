/** @jest-environment jsdom */

const React = require("react")
const { render, screen, fireEvent } = require("@testing-library/react")
const SetupForm = require("../frontend/app/SetupForm.jsx").default

const fillForm = ({ username = "alice", password = "longenough1", confirmPassword = "longenough1", token = "topsecret" } = {}) => {
	fireEvent.change(screen.getByPlaceholderText("username"), { target: { value: username } })
	fireEvent.change(screen.getByPlaceholderText("password"), { target: { value: password } })
	fireEvent.change(screen.getByPlaceholderText("confirm password"), { target: { value: confirmPassword } })
	fireEvent.change(screen.getByPlaceholderText("setup token"), { target: { value: token } })
}

test("the browser's Enter-key implicit submission reaches trySetup with the current field values", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: true }))

	fillForm()
	fireEvent.submit(screen.getByPlaceholderText("password").closest("form"))

	expect(trySetup).toHaveBeenCalledWith("alice", "longenough1", "topsecret", expect.any(Function))
})

test("clicking Create Account submits the form via type=submit", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: true }))

	fillForm({ username: "bob", password: "hunter22", confirmPassword: "hunter22", token: "tok" })
	fireEvent.click(screen.getByText("Create Account"))

	expect(trySetup).toHaveBeenCalledWith("bob", "hunter22", "tok", expect.any(Function))
})

test("a password/confirm mismatch blocks submission and shows an error", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: true }))

	fillForm({ password: "longenough1", confirmPassword: "different1" })
	fireEvent.click(screen.getByText("Create Account"))

	expect(trySetup).not.toHaveBeenCalled()
	expect(screen.getByText("Passwords do not match.")).toBeTruthy()
})

test("submit does not trigger native page navigation", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: true }))

	const form = screen.getByText("Create Account").closest("form")
	const submitEvent = new window.Event("submit", { bubbles: true, cancelable: true })
	fireEvent(form, submitEvent)

	expect(submitEvent.defaultPrevented).toBe(true)
})

test("does not render the setup form when no token is configured", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: false }))

	expect(screen.queryByPlaceholderText("username")).toBeNull()
	expect(screen.getByText("Setup unavailable")).toBeTruthy()
})
