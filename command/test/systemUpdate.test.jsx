/** @jest-environment jsdom */

const React = require("react")
const { render, screen, fireEvent, waitFor, act } = require("@testing-library/react")

jest.mock("../frontend/js/request.js", () => ({
	request: jest.fn(() => Promise.resolve({ error: false, state: "idle", last: null })),
	authPromiseHandler: jest.fn()
}))
jest.mock("../frontend/js/toast.js", () => jest.fn())

const { request } = require("../frontend/js/request.js")
const toast = require("../frontend/js/toast.js")
const SystemUpdate = require("../frontend/app/SystemUpdate.jsx").default

const status = (body) => request.mockImplementationOnce(() => Promise.resolve({ error: false, ...body }))

const buttons = () => screen.getAllByRole("button", { name: "Update Now" })

const confirmUpdate = async () => {
	await act(async () => { fireEvent.click(buttons()[0]) })
	await act(async () => { fireEvent.click(buttons().at(-1)) })
}

beforeEach(() => {
	toast.mockClear()
	request.mockReset().mockImplementation(() => Promise.resolve({ error: false, state: "idle", last: null }))
})

test("reads the current state on mount before offering the button", async () => {
	render(React.createElement(SystemUpdate))

	await waitFor(() => expect(request).toHaveBeenCalledWith("/system/update", { method: "GET" }, expect.anything()))
	expect(buttons()[0].disabled).toBe(false)
})

test("confirming posts the request and says so", async () => {
	render(React.createElement(SystemUpdate))
	await waitFor(() => expect(request).toHaveBeenCalled())
	status({ error: false })

	await confirmUpdate()

	await waitFor(() => expect(request).toHaveBeenCalledWith("/system/update", { method: "POST" }, expect.anything()))
	await waitFor(() => expect(toast).toHaveBeenCalledWith("Update requested"))
})

// a rebuild takes minutes with no other feedback, and a second one on top of it would be a mess
test("an update already on the bridge disables the button and names who asked", async () => {
	status({ state: "pending", requestedBy: "alex", last: null })
	render(React.createElement(SystemUpdate))

	await screen.findByText(/Requested by alex/)
	expect(buttons()[0].disabled).toBe(true)
})

test("a rebuild in flight is not reported as finished, whatever the last result was", async () => {
	status({ state: "running", requestedBy: "alex", last: { success: true, at: "2026-08-12T00:00:00.000Z" } })
	render(React.createElement(SystemUpdate))

	await screen.findByText(/Update running/)
	expect(buttons()[0].disabled).toBe(true)
})

test("a failed update keeps the reason on screen", async () => {
	status({ state: "idle", last: { success: false, message: "`git pull` exited 1", at: "2026-08-12T00:00:00.000Z" } })
	render(React.createElement(SystemUpdate))

	await screen.findByText(/`git pull` exited 1/)
	expect(buttons()[0].disabled).toBe(false)
})

test("a rejected request is reported rather than passed off as accepted", async () => {
	render(React.createElement(SystemUpdate))
	await waitFor(() => expect(request).toHaveBeenCalled())
	request.mockImplementationOnce(() => Promise.resolve({ error: true, errors: "UPDATE_IN_PROGRESS" }))

	await confirmUpdate()

	await waitFor(() => expect(toast).toHaveBeenCalledWith("An update is already running"))
})
