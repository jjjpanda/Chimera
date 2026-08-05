/** @jest-environment jsdom */

const React = require("react")
const { render, screen, fireEvent } = require("@testing-library/react")
const ChangePasswordForm = require("../frontend/app/ChangePasswordForm.jsx").default

const fill = ({ password = "longenough123", confirm = "longenough123" } = {}) => {
	fireEvent.change(screen.getByLabelText("New Password"), { target: { value: password } })
	fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: confirm } })
}

test("both fields are reachable by their visible labels", () => {
	const changePassword = jest.fn()
	render(React.createElement(ChangePasswordForm, { changePassword }))

	fill()
	fireEvent.click(screen.getByText("Set Password"))

	expect(changePassword).toHaveBeenCalledWith({ password: "longenough123" }, expect.any(Function))
})

test("submitting two empty fields asks for a password instead of reporting a mismatch", () => {
	const changePassword = jest.fn()
	render(React.createElement(ChangePasswordForm, { changePassword }))

	fireEvent.click(screen.getByText("Set Password"))

	expect(changePassword).not.toHaveBeenCalled()
	expect(screen.getByRole("alert").textContent).toBe("Enter and confirm your new password.")
})

test("leaving only the confirm field blank does not claim a mismatch", () => {
	const changePassword = jest.fn()
	render(React.createElement(ChangePasswordForm, { changePassword }))

	fill({ confirm: "" })
	fireEvent.click(screen.getByText("Set Password"))

	expect(changePassword).not.toHaveBeenCalled()
	expect(screen.getByRole("alert").textContent).toBe("Enter and confirm your new password.")
})

test("two different non-empty passwords still report a mismatch", () => {
	const changePassword = jest.fn()
	render(React.createElement(ChangePasswordForm, { changePassword }))

	fill({ confirm: "different1" })
	fireEvent.click(screen.getByText("Set Password"))

	expect(changePassword).not.toHaveBeenCalled()
	expect(screen.getByRole("alert").textContent).toBe("Passwords do not match.")
})

test("a rejected change is announced", () => {
	const changePassword = jest.fn((body, cb) => cb(false, "Server said no"))
	render(React.createElement(ChangePasswordForm, { changePassword }))

	fill()
	fireEvent.click(screen.getByText("Set Password"))

	expect(screen.getByRole("alert").textContent).toBe("Server said no")
})
