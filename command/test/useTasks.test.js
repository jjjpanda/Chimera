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

const { renderHook, act } = require("@testing-library/react")
const useTasks = require("../frontend/hooks/useTasks.js").default
const { __calls: calls } = require("../frontend/js/request.js")
const toast = require("../frontend/js/toast.js").default

const task = (id, running) => ({ id, running })

const listCalls = () => calls.filter((c) => c.url === "/task/list")

const resolveList = (data) => act(async () => {
	const call = listCalls().find((c) => !c.resolved)
	if (!call) throw new Error("no unresolved /task/list call")
	call.resolved = true
	call.resolve({ tasks: data })
	await Promise.resolve()
})

beforeEach(() => {
	calls.length = 0
	toast.mockClear()
})

test("fetches once on mount and never on a timer, even with an armed task", async () => {
	jest.useFakeTimers()
	try {
		renderHook(() => useTasks())
		await resolveList([task(1, true)])

		act(() => { jest.advanceTimersByTime(60000) })
		expect(listCalls()).toHaveLength(1)
	} finally {
		jest.useRealTimers()
	}
})

test("the returned reload triggers a refetch", async () => {
	const { result } = renderHook(() => useTasks())
	await resolveList([task(1, true)])
	expect(result.current[0].processList).toEqual([task(1, true)])

	act(() => { result.current[4]() })
	expect(listCalls()).toHaveLength(2)

	await resolveList([task(1, true), task(2, false)])
	expect(result.current[0].processList).toEqual([task(1, true), task(2, false)])
})

test("a response without a tasks key empties the list and clears loading", async () => {
	const { result } = renderHook(() => useTasks())
	await act(async () => {
		const call = listCalls().find((c) => !c.resolved)
		call.resolved = true
		call.resolve({ error: "memory unavailable" })
		await Promise.resolve()
	})
	expect(result.current[0].processList).toEqual([])
	expect(result.current[0].loading).toBe(false)
})

test("a non-200 mutate response toasts and still schedules a reload", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useTasks())
		await resolveList([task(1, true)])

		act(() => { result.current[1](1) })

		const call = calls.find((c) => c.url === "/task/start")
		expect(call).toBeDefined()

		await act(async () => {
			call.resolve({ status: 500 })
			await Promise.resolve()
		})
		expect(toast).toHaveBeenCalledWith("Couldn't restart task")

		act(() => { jest.advanceTimersByTime(1500) })
		expect(listCalls().length).toBeGreaterThan(1)
	} finally {
		jest.useRealTimers()
	}
})

test("a 200 mutate response does not toast", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useTasks())
		await resolveList([task(1, true)])

		act(() => { result.current[2](1) })

		const call = calls.find((c) => c.url === "/task/stop")
		await act(async () => {
			call.resolve({ status: 200 })
			await Promise.resolve()
		})
		expect(toast).not.toHaveBeenCalled()
	} finally {
		jest.useRealTimers()
	}
})
