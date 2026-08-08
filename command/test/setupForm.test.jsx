/** @jest-environment jsdom */

const React = require("react")
const { render, screen, fireEvent } = require("@testing-library/react")
const SetupForm = require("../frontend/app/SetupForm.jsx").default
const PASSWORD_REQUIREMENT = require("../frontend/js/errors.js").default("PASSWORD_TOO_SHORT")

const fillForm = ({ username = "alice", password = "correct-horse-battery", confirmPassword = "correct-horse-battery", token = "topsecret" } = {}) => {
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

	expect(trySetup).toHaveBeenCalledWith("alice", "correct-horse-battery", "topsecret", expect.any(Function))
})

test("clicking Create Account submits the form via type=submit", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: true }))

	fillForm({ username: "bob", password: "bobs-long-passphrase", confirmPassword: "bobs-long-passphrase", token: "tok" })
	fireEvent.click(screen.getByText("Create Account"))

	expect(trySetup).toHaveBeenCalledWith("bob", "bobs-long-passphrase", "tok", expect.any(Function))
})

test("a password/confirm mismatch blocks submission and announces the error", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: true }))

	fillForm({ password: "correct-horse-battery", confirmPassword: "different1" })
	fireEvent.click(screen.getByText("Create Account"))

	expect(trySetup).not.toHaveBeenCalled()
	expect(screen.getByRole("alert").textContent).toBe("Passwords do not match.")
})

test("every field is reachable by its visible label", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: true }))

	fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } })
	fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longenough123" } })
	fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "longenough123" } })
	fireEvent.change(screen.getByLabelText("Setup Token"), { target: { value: "topsecret" } })
	fireEvent.click(screen.getByText("Create Account"))

	expect(trySetup).toHaveBeenCalledWith("alice", "longenough123", "topsecret", expect.any(Function))
})

test("states the password requirement before anything is submitted", () => {
	render(React.createElement(SetupForm, { trySetup: jest.fn(), tokenRequired: true }))

	expect(screen.getByText(PASSWORD_REQUIREMENT)).toBeTruthy()
})

test("a password shorter than the minimum length blocks submission and shows an error", () => {
	const trySetup = jest.fn()
	render(React.createElement(SetupForm, { trySetup, tokenRequired: true }))

	fillForm({ password: "short", confirmPassword: "short" })
	fireEvent.click(screen.getByText("Create Account"))

	expect(trySetup).not.toHaveBeenCalled()
	expect(screen.getAllByText(PASSWORD_REQUIREMENT)).toHaveLength(2)
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
