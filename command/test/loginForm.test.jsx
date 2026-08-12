/** @jest-environment jsdom */

const React = require("react")
const { render, screen, fireEvent } = require("@testing-library/react")
const LoginForm = require("../frontend/app/LoginForm.jsx").default

test("the browser's Enter-key implicit submission (a native 'submit' event on the form) reaches tryLogin with the current field values", () => {
	const tryLogin = jest.fn()
	render(React.createElement(LoginForm, { tryLogin }))

	fireEvent.change(screen.getByPlaceholderText("username"), { target: { value: "alice" } })
	fireEvent.change(screen.getByPlaceholderText("password"), { target: { value: "secret" } })
	fireEvent.submit(screen.getByPlaceholderText("password").closest("form"))

	expect(tryLogin).toHaveBeenCalledWith("alice", "secret", expect.any(Function))
})

test("clicking Sign In submits the form via type=submit", () => {
	const tryLogin = jest.fn()
	render(React.createElement(LoginForm, { tryLogin }))

	fireEvent.change(screen.getByPlaceholderText("username"), { target: { value: "bob" } })
	fireEvent.change(screen.getByPlaceholderText("password"), { target: { value: "hunter2" } })
	fireEvent.click(screen.getByText("Sign In"))

	expect(tryLogin).toHaveBeenCalledWith("bob", "hunter2", expect.any(Function))
})

test("each field is reachable by its visible label", () => {
	const tryLogin = jest.fn()
	render(React.createElement(LoginForm, { tryLogin }))

	fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } })
	fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } })
	fireEvent.click(screen.getByText("Sign In"))

	expect(tryLogin).toHaveBeenCalledWith("alice", "secret", expect.any(Function))
})

test("a rejected login is announced rather than only shown", () => {
	const tryLogin = jest.fn((username, password, cb) => cb(false, "INVALID_CREDENTIALS"))
	render(React.createElement(LoginForm, { tryLogin }))

	fireEvent.click(screen.getByText("Sign In"))

	expect(screen.getByRole("alert").textContent).toBe("Invalid username or password.")
})

test("a server error code is resolved to its English wording", () => {
	const tryLogin = jest.fn((username, password, cb) => cb(false, "TOO_MANY_ATTEMPTS"))
	render(React.createElement(LoginForm, { tryLogin }))

	fireEvent.click(screen.getByText("Sign In"))

	expect(screen.getByRole("alert").textContent).toBe("Too many attempts")
})

test("the language picker stays collapsed until Change language is clicked, which must not submit the form", () => {
	const tryLogin = jest.fn()
	render(React.createElement(LoginForm, { tryLogin }))
	expect(screen.queryByRole("combobox")).toBeNull()

	fireEvent.click(screen.getByText("Change language"))

	expect(screen.getByRole("combobox")).toBeTruthy()
	expect(tryLogin).not.toHaveBeenCalled()
})

test("submit does not trigger native page navigation", () => {
	const tryLogin = jest.fn()
	render(React.createElement(LoginForm, { tryLogin }))

	const form = screen.getByText("Sign In").closest("form")
	const submitEvent = new window.Event("submit", { bubbles: true, cancelable: true })
	fireEvent(form, submitEvent)

	expect(submitEvent.defaultPrevented).toBe(true)
})
