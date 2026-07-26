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

test("submit does not trigger native page navigation", () => {
	const tryLogin = jest.fn()
	render(React.createElement(LoginForm, { tryLogin }))

	const form = screen.getByText("Sign In").closest("form")
	const submitEvent = new window.Event("submit", { bubbles: true, cancelable: true })
	fireEvent(form, submitEvent)

	expect(submitEvent.defaultPrevented).toBe(true)
})
