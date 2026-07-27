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

const runsCalls = (url = "/task/runs") => calls.filter((c) => c.url === url)

const resolveRuns = (runs) => act(async () => {
	const call = runsCalls().find((c) => !c.resolved)
	if (!call) throw new Error("no unresolved /task/runs call")
	call.resolved = true
	call.resolve({ runs })
	await Promise.resolve()
})

beforeEach(() => { calls.length = 0 })

test("fetches once on mount and never on a timer", async () => {
	jest.useFakeTimers()
	try {
		renderHook(() => useTaskRuns())
		await resolveRuns([{ id: 1 }])

		act(() => { jest.advanceTimersByTime(60000) })
		expect(runsCalls()).toHaveLength(1)
	} finally {
		jest.useRealTimers()
	}
})

test("the returned reload triggers a refetch", async () => {
	const { result } = renderHook(() => useTaskRuns())
	await resolveRuns([{ id: 1 }])
	expect(result.current[0].runs).toEqual([{ id: 1 }])

	act(() => { result.current[1]() })
	expect(runsCalls()).toHaveLength(2)

	await resolveRuns([{ id: 1 }, { id: 2 }])
	expect(result.current[0].runs).toEqual([{ id: 1 }, { id: 2 }])
	expect(result.current[0].loading).toBe(false)
})

test("raises loading while a fetch is in flight", async () => {
	const { result } = renderHook(() => useTaskRuns())
	expect(result.current[0].loading).toBe(true)

	await resolveRuns([{ id: 1 }])
	expect(result.current[0].loading).toBe(false)
})

test("a failed fetch empties the list and clears loading", async () => {
	const { result } = renderHook(() => useTaskRuns())
	await act(async () => {
		const call = runsCalls().find((c) => !c.resolved)
		call.resolved = true
		call.resolve({ error: true })
		await Promise.resolve()
	})
	expect(result.current[0].runs).toEqual([])
	expect(result.current[0].loading).toBe(false)
})

test("scopes the request to a task id when given one", () => {
	renderHook(() => useTaskRuns("task-1"))
	expect(runsCalls("/task/runs/task-1")).toHaveLength(1)
	expect(runsCalls()).toHaveLength(0)
})
