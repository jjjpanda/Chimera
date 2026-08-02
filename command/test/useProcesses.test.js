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
		jsonProcessing: (prom, cb) => { prom.then(cb) }
	}
})

jest.mock("../frontend/js/toast.js", () => ({ __esModule: true, default: () => {} }))

const { renderHook, act } = require("@testing-library/react")
const useProcesses = require("../frontend/hooks/useProcesses.js").default
const { __calls: calls } = require("../frontend/js/request.js")

const proc = (id, running) => ({ id, running, requested: "20260101-000000" })

const listCalls = () => calls.filter((c) => c.url === "/convert/listProcess")

const resolveList = (list) => act(async () => {
	const call = listCalls().find((c) => !c.resolved)
	if (!call) throw new Error("no unresolved /convert/listProcess call")
	call.resolved = true
	call.resolve({ list })
	await Promise.resolve()
})

beforeEach(() => { calls.length = 0 })

test("an idle list still polls, slowly, so an export started elsewhere shows up", async () => {
	jest.useFakeTimers()
	try {
		renderHook(() => useProcesses())
		await resolveList([proc(1, false)])

		act(() => { jest.advanceTimersByTime(15000) })
		expect(listCalls()).toHaveLength(1)

		await act(async () => {
			jest.advanceTimersByTime(15000)
			await Promise.resolve()
		})
		expect(listCalls()).toHaveLength(2)
	} finally {
		jest.useRealTimers()
	}
})

test("a running process polls every 5s, and drops back to the idle cadence once nothing is running", async () => {
	jest.useFakeTimers()
	try {
		renderHook(() => useProcesses())
		await resolveList([proc(1, true)])
		expect(listCalls()).toHaveLength(1)

		await act(async () => {
			jest.advanceTimersByTime(5000)
			await Promise.resolve()
		})
		expect(listCalls()).toHaveLength(2)

		await resolveList([proc(1, false)])

		act(() => { jest.advanceTimersByTime(15000) })
		expect(listCalls()).toHaveLength(2)

		await act(async () => {
			jest.advanceTimersByTime(15000)
			await Promise.resolve()
		})
		expect(listCalls()).toHaveLength(3)
	} finally {
		jest.useRealTimers()
	}
})

test("a failed silent poll keeps the last good list and the poll keeps running", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useProcesses())
		await resolveList([proc(1, true)])
		expect(result.current[0].processList).toEqual([proc(1, true)])

		act(() => { jest.advanceTimersByTime(5000) })
		await act(async () => {
			const call = listCalls().find((c) => !c.resolved)
			call.resolved = true
			call.resolve({ error: true })
			await Promise.resolve()
		})
		expect(result.current[0].processList).toEqual([proc(1, true)])

		await act(async () => {
			jest.advanceTimersByTime(5000)
			await Promise.resolve()
		})
		expect(listCalls()).toHaveLength(3)
	} finally {
		jest.useRealTimers()
	}
})
