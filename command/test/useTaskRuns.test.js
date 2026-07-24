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

const { renderHook, act } = require("@testing-library/react")
const useTaskRuns = require("../frontend/hooks/useTaskRuns.js").default
const { __calls: calls } = require("../frontend/js/request.js")

const runsCalls = () => calls.filter((c) => c.url === "/task/runs")

const resolveRuns = (runs) => act(async () => {
	const call = runsCalls().find((c) => !c.resolved)
	if (!call) throw new Error("no unresolved /task/runs call")
	call.resolved = true
	call.resolve({ runs })
	await Promise.resolve()
})

beforeEach(() => { calls.length = 0 })

test("does not poll while inactive", async () => {
	jest.useFakeTimers()
	try {
		renderHook(() => useTaskRuns(undefined, false))
		await resolveRuns([{ id: 1 }])

		act(() => { jest.advanceTimersByTime(15000) })
		expect(runsCalls()).toHaveLength(1)
	} finally {
		jest.useRealTimers()
	}
})

test("polls every 5s while active, and stops once active goes false", async () => {
	jest.useFakeTimers()
	try {
		const { rerender } = renderHook(({ active }) => useTaskRuns(undefined, active), { initialProps: { active: true } })
		await resolveRuns([{ id: 1 }])
		expect(runsCalls()).toHaveLength(1)

		await act(async () => {
			jest.advanceTimersByTime(5000)
			await Promise.resolve()
		})
		expect(runsCalls()).toHaveLength(2)

		rerender({ active: false })
		act(() => { jest.advanceTimersByTime(15000) })
		expect(runsCalls()).toHaveLength(2)
	} finally {
		jest.useRealTimers()
	}
})

test("a silent poll does not raise the loading flag", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useTaskRuns(undefined, true))
		await resolveRuns([{ id: 1 }])
		expect(result.current[0].loading).toBe(false)

		act(() => { jest.advanceTimersByTime(5000) })
		expect(result.current[0].loading).toBe(false)

		await resolveRuns([{ id: 1 }, { id: 2 }])
		expect(result.current[0].runs).toEqual([{ id: 1 }, { id: 2 }])
		expect(result.current[0].loading).toBe(false)
	} finally {
		jest.useRealTimers()
	}
})
