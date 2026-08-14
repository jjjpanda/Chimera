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

	await waitFor(() => expect(request).toHaveBeenCalledWith("/system/update", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ allowMajor: false })
	}, expect.anything()))
	await waitFor(() => expect(toast).toHaveBeenCalledWith("Update requested"))
})

// a rebuild takes minutes with no other feedback, and a second one on top of it would be a mess
test("an update already on the bridge disables the button and names who asked", async () => {
	status({ state: "pending", requestedBy: "alex", last: null })
	render(React.createElement(SystemUpdate))

	await screen.findByText(/Requested by alex/)
	expect(buttons()[0].disabled).toBe(true)
})

test("cancelling asks the backend to drop the request and says so", async () => {
	status({ state: "pending", requestedBy: "alex", last: null })
	render(React.createElement(SystemUpdate))
	await screen.findByText(/Requested by alex/)
	status({ error: false })

	await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel Request" })) })

	await waitFor(() => expect(request).toHaveBeenCalledWith("/system/update", { method: "DELETE" }, expect.anything()))
	await waitFor(() => expect(toast).toHaveBeenCalledWith("Update request cancelled"))
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

// fetchStatus is also what the poll interval calls every 5s while busy — the backend is unreachable for the
// whole rebuild (docker:down runs before docker:up), so a transport failure there must not read as "idle"
test("a fetch that fails keeps the on-screen state instead of falling back to idle", async () => {
	status({ state: "pending", requestedBy: "alex", last: null })
	render(React.createElement(SystemUpdate))
	await screen.findByText(/Requested by alex/)

	request
		.mockImplementationOnce(() => Promise.resolve({ error: false }))
		.mockImplementationOnce(() => Promise.resolve({ error: true }))

	await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cancel Request" })) })

	expect(screen.queryByText(/Requested by alex/)).not.toBeNull()
})

describe("versions", () => {
	const version = (bump, extra = {}) => ({ current: "6.0.2", available: "7.0.0", checkedAt: null, bump, ...extra })

	test("names the version on offer before the admin commits to it", async () => {
		status({ state: "idle", last: null, version: version("major") })
		render(React.createElement(SystemUpdate))

		await screen.findByText(/Version 6\.0\.2, 7\.0\.0 available — a major version\./)
	})

	test("a host already on the newest version says so instead of offering a bump", async () => {
		status({ state: "idle", last: null, version: version("none", { available: "6.0.2" }) })
		render(React.createElement(SystemUpdate))

		await screen.findByText(/Version 6\.0\.2, up to date\./)
	})

	// the host refuses a major without allowMajor, so an unchecked box would be a request that can only be held
	test("a major bump holds the confirm button until the admin ticks the box", async () => {
		status({ state: "idle", last: null, version: version("major") })
		render(React.createElement(SystemUpdate))
		await screen.findByText(/a major version/)

		await act(async () => { fireEvent.click(buttons()[0]) })
		expect(buttons().at(-1).disabled).toBe(true)

		await act(async () => { fireEvent.click(screen.getByRole("checkbox")) })
		expect(buttons().at(-1).disabled).toBe(false)
	})

	test("a ticked box is what carries the confirmation to the host", async () => {
		status({ state: "idle", last: null, version: version("major") })
		render(React.createElement(SystemUpdate))
		await screen.findByText(/a major version/)
		status({ error: false })

		await act(async () => { fireEvent.click(buttons()[0]) })
		await act(async () => { fireEvent.click(screen.getByRole("checkbox")) })
		await act(async () => { fireEvent.click(buttons().at(-1)) })

		await waitFor(() => expect(request).toHaveBeenCalledWith("/system/update",
			expect.objectContaining({ body: JSON.stringify({ allowMajor: true }) }), expect.anything()))
	})

	test("a minor bump is named in the dialog but needs no box to tick", async () => {
		status({ state: "idle", last: null, version: version("minor", { available: "6.1.0" }) })
		render(React.createElement(SystemUpdate))
		await screen.findByText(/Version 6\.0\.2, 6\.1\.0 available\./)

		await act(async () => { fireEvent.click(buttons()[0]) })

		await screen.findByText(/This is a minor update, 6\.0\.2 → 6\.1\.0\./)
		expect(screen.queryByRole("checkbox")).toBeNull()
		expect(buttons().at(-1).disabled).toBe(false)
	})

	// version.json can be an hour old, so the host is the gate and the panel has to report what it decided
	test("an update the host held reads as held rather than failed", async () => {
		status({ state: "idle", version: version("major"), last: { success: false, blocked: true, from: "6.0.2", to: "7.0.0", at: "2026-08-12T00:00:00.000Z" } })
		render(React.createElement(SystemUpdate))

		await screen.findByText(/is a major version\. Confirm it to go ahead\./)
	})
})

test("a rejected request is reported rather than passed off as accepted", async () => {
	render(React.createElement(SystemUpdate))
	await waitFor(() => expect(request).toHaveBeenCalled())
	request.mockImplementationOnce(() => Promise.resolve({ error: true, errors: "UPDATE_IN_PROGRESS" }))

	await confirmUpdate()

	await waitFor(() => expect(toast).toHaveBeenCalledWith("An update is already running"))
})
