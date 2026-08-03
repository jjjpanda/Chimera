/** @jest-environment jsdom */

jest.mock("../frontend/js/request.js", () => {
	const calls = []
	return {
		__calls: calls,
		request: (url, opts, cb) => {
			let resolve
			const promise = new Promise((res) => { resolve = res })
			calls.push({ url, opts, resolve })
			cb(promise)
		},
		jsonProcessing: (prom, cb) => { prom.then(cb).catch(() => cb(undefined)) }
	}
})

jest.mock("../frontend/js/toast.js", () => ({ __esModule: true, default: jest.fn() }))

const React = require("react")
const { render, act, screen, fireEvent } = require("@testing-library/react")
const ScheduleDashboard = require("../frontend/app/ScheduleDashboard.jsx").default
const AuthContext = require("../frontend/app/AuthContext.jsx").default
const { __calls: calls } = require("../frontend/js/request.js")

const callsTo = (url) => calls.filter((c) => c.url === url)

const resolve = (url, data) => act(async () => {
	const call = callsTo(url).find((c) => !c.resolved)
	if (!call) throw new Error(`no unresolved ${url} call`)
	call.resolved = true
	call.resolve(data)
	await Promise.resolve()
})

beforeEach(() => { calls.length = 0 })

describe("run-history refresh wiring", () => {
	const mount = async (tasks) => {
		render(React.createElement(ScheduleDashboard))
		await resolve("/cameras", [])
		await resolve("/task/runs", { runs: [] })
		await resolve("/task/list", { tasks })
	}

	test("an armed task does not start a background poll", async () => {
		jest.useFakeTimers()
		try {
			await mount([{ id: "a", running: true }])
			expect(callsTo("/task/runs")).toHaveLength(1)
			expect(callsTo("/task/list")).toHaveLength(1)

			await act(async () => {
				jest.advanceTimersByTime(60000)
				await Promise.resolve()
			})
			expect(callsTo("/task/runs")).toHaveLength(1)
			expect(callsTo("/task/list")).toHaveLength(1)
		} finally {
			jest.useRealTimers()
		}
	})

	test("the refresh button refetches run history", async () => {
		await mount([{ id: "a", running: true }])
		expect(callsTo("/task/runs")).toHaveLength(1)

		await act(async () => { fireEvent.click(screen.getByTitle("Refresh run history")) })
		expect(callsTo("/task/runs")).toHaveLength(2)
	})

	test("the refresh button refetches the task list", async () => {
		await mount([{ id: "a", running: true }])
		expect(callsTo("/task/list")).toHaveLength(1)

		await act(async () => { fireEvent.click(screen.getByTitle("Refresh tasks")) })
		expect(callsTo("/task/list")).toHaveLength(2)
		expect(callsTo("/task/runs")).toHaveLength(1)
	})
})

describe("schedule parameters resolve by their visible labels", () => {
	const mountAsAdmin = async () => {
		render(React.createElement(AuthContext.Provider, { value: { role: "admin" } },
			React.createElement(ScheduleDashboard)))
		await resolve("/cameras", [])
		await resolve("/task/runs", { runs: [] })
		await resolve("/task/list", { tasks: [] })
	}

	test("the camera select is named by its label", async () => {
		await mountAsAdmin()

		expect(screen.getByLabelText("Camera")).toBeTruthy()
	})

	test("the skip input is named by its label", async () => {
		await mountAsAdmin()

		expect(screen.getByLabelText("Skip")).toBeTruthy()
	})

	test("the window presets are a group named by their label", async () => {
		await mountAsAdmin()

		expect(screen.getByRole("group", { name: "Window" })).toBeTruthy()
	})

	test("the fps steppers are a group named by their label", async () => {
		await mountAsAdmin()

		expect(screen.getByRole("group", { name: "FPS" })).toBeTruthy()
	})
})
