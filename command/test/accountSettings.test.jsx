/** @jest-environment jsdom */

const React = require("react")
const { render, screen, fireEvent } = require("@testing-library/react")
const { MemoryRouter } = require("react-router-dom")
const AccountSettings = require("../frontend/app/AccountSettings.jsx").default
const AuthContext = require("../frontend/app/AuthContext.jsx").default
const { routeToIndex, indexToRoute, adminRoutes } = require("../frontend/js/routeIndexMapping.js")
const { PASSWORD_REQUIREMENT } = require("../frontend/js/password.js")

const renderForm = (changePassword) =>
	render(React.createElement(AuthContext.Provider, { value: { role: "user", signOut: jest.fn(), changePassword } },
		React.createElement(AccountSettings)))

const fill = ({ current = "oldpassword", password = "replacement-passphrase", confirm = "replacement-passphrase" } = {}) => {
	fireEvent.change(screen.getByPlaceholderText("current password"), { target: { value: current } })
	fireEvent.change(screen.getByPlaceholderText("new password"), { target: { value: password } })
	fireEvent.change(screen.getByPlaceholderText("re-enter new password"), { target: { value: confirm } })
}

test("submits the current password alongside the new one", () => {
	const changePassword = jest.fn()
	renderForm(changePassword)

	fill()
	fireEvent.click(screen.getByText("Change Password", { selector: "button" }))

	expect(changePassword).toHaveBeenCalledWith(
		{ password: "replacement-passphrase", currentPassword: "oldpassword" },
		expect.any(Function)
	)
})

test("ignores a second submit while a change is in flight", () => {
	const changePassword = jest.fn()
	renderForm(changePassword)

	fill()
	const button = screen.getByText("Change Password", { selector: "button" })
	fireEvent.click(button)
	fireEvent.click(button)

	expect(changePassword).toHaveBeenCalledTimes(1)
})

test("blocks submission when the current password is blank", () => {
	const changePassword = jest.fn()
	renderForm(changePassword)

	fill({ current: "" })
	fireEvent.click(screen.getByText("Change Password", { selector: "button" }))

	expect(changePassword).not.toHaveBeenCalled()
})

test("blocks submission on a confirm mismatch, a too-short password or a blocklisted one", () => {
	const changePassword = jest.fn()
	renderForm(changePassword)

	fill({ confirm: "different1" })
	fireEvent.click(screen.getByText("Change Password", { selector: "button" }))
	expect(changePassword).not.toHaveBeenCalled()

	fill({ password: "short", confirm: "short" })
	fireEvent.click(screen.getByText("Change Password", { selector: "button" }))
	expect(changePassword).not.toHaveBeenCalled()

	fill({ password: "PasswordPassword", confirm: "PasswordPassword" })
	fireEvent.click(screen.getByText("Change Password", { selector: "button" }))
	expect(changePassword).not.toHaveBeenCalled()
})

test("states the password requirement before anything is submitted", () => {
	renderForm(jest.fn())

	expect(screen.getByText(PASSWORD_REQUIREMENT)).toBeTruthy()
})

test("the account route is reachable by every signed-in user", () => {
	expect(routeToIndex("account")).toBe("route-8")
	expect(indexToRoute("route-8")).toBe("/account")
	expect(adminRoutes.has("route-8")).toBe(false)
})

test.each([
	["DesktopView", "../frontend/app/DesktopView.jsx"],
	["MobileView", "../frontend/app/MobileView.jsx"],
])("%s dispatches route-8 to the account page for a non-admin", (name, path) => {
	const View = require(path).default
	render(React.createElement(MemoryRouter, null,
		React.createElement(AuthContext.Provider, { value: { role: "user", signOut: jest.fn(), changePassword: jest.fn() } },
			React.createElement(View, { index: "route-8" }))))

	expect(screen.getByPlaceholderText("current password")).toBeTruthy()
})
