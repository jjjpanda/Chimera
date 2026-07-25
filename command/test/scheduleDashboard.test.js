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
		jsonProcessing: (prom, cb) => { prom.then(cb) },
		statusProcessing: (prom, code, cb) => { prom.then((res) => cb(res.status === code)).catch(() => cb(false)) }
	}
})

jest.mock("../frontend/js/toast.js", () => ({ __esModule: true, default: jest.fn() }))

const React = require("react")
const { render, act, screen, fireEvent } = require("@testing-library/react")
const ScheduleDashboard = require("../frontend/app/ScheduleDashboard.jsx").default
const { taskIdKey } = require("../frontend/app/ScheduleDashboard.jsx")
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

test("stays the same across a silent poll that changes nothing", () => {
	const before = taskIdKey([{ id: 1, running: true }, { id: 2, running: false }])
	const after = taskIdKey([{ id: 1, running: true }, { id: 2, running: false }])
	expect(after).toBe(before)
})

test("changes when a task's running state flips, even though the id set is unchanged", () => {
	const before = taskIdKey([{ id: 1, running: true }])
	const after = taskIdKey([{ id: 1, running: false }])
	expect(after).not.toBe(before)
})

test("changes when the id set changes", () => {
	const before = taskIdKey([{ id: 1, running: true }])
	const after = taskIdKey([{ id: 1, running: true }, { id: 2, running: false }])
	expect(after).not.toBe(before)
})

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

		await act(async () => { fireEvent.click(screen.getByTitle("Refresh")) })
		expect(callsTo("/task/runs")).toHaveLength(2)
	})
})
