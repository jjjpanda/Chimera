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
const useTasks = require("../frontend/hooks/useTasks.js").default
const { __calls: calls } = require("../frontend/js/request.js")

const task = (id, running) => ({ id, running })

const listCalls = () => calls.filter((c) => c.url === "/task/list")

const resolveList = (data) => act(async () => {
	const call = listCalls().find((c) => !c.resolved)
	if (!call) throw new Error("no unresolved /task/list call")
	call.resolved = true
	call.resolve({ tasks: data })
	await Promise.resolve()
})

beforeEach(() => { calls.length = 0 })

test("no poll starts when nothing is running", async () => {
	jest.useFakeTimers()
	try {
		renderHook(() => useTasks())
		await resolveList([task(1, false)])

		act(() => { jest.advanceTimersByTime(15000) })
		expect(listCalls()).toHaveLength(1)
	} finally {
		jest.useRealTimers()
	}
})

test("a running task starts a 5s poll, and it stops once nothing is running", async () => {
	jest.useFakeTimers()
	try {
		renderHook(() => useTasks())
		await resolveList([task(1, true)])
		expect(listCalls()).toHaveLength(1)

		await act(async () => {
			jest.advanceTimersByTime(5000)
			await Promise.resolve()
		})
		expect(listCalls()).toHaveLength(2)

		await resolveList([task(1, false)])

		act(() => { jest.advanceTimersByTime(15000) })
		expect(listCalls()).toHaveLength(2)
	} finally {
		jest.useRealTimers()
	}
})

test("a silent poll does not clear processList or raise loading", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useTasks())
		await resolveList([task(1, true)])
		expect(result.current[0].processList).toEqual([task(1, true)])
		expect(result.current[0].loading).toBe(false)

		act(() => { jest.advanceTimersByTime(5000) })

		expect(result.current[0].processList).toEqual([task(1, true)])
		expect(result.current[0].loading).toBe(false)

		await resolveList([task(1, true), task(2, false)])
		expect(result.current[0].processList).toEqual([task(1, true), task(2, false)])
	} finally {
		jest.useRealTimers()
	}
})
