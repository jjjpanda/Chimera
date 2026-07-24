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

test("a failed silent poll keeps the last good list and the poll keeps running", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useTasks())
		await resolveList([task(1, true)])
		expect(result.current[0].processList).toEqual([task(1, true)])

		act(() => { jest.advanceTimersByTime(5000) })
		await act(async () => {
			const call = listCalls().find((c) => !c.resolved)
			call.resolved = true
			call.resolve({ error: "memory unavailable" })
			await Promise.resolve()
		})
		expect(result.current[0].processList).toEqual([task(1, true)])

		await act(async () => {
			jest.advanceTimersByTime(5000)
			await Promise.resolve()
		})
		expect(listCalls()).toHaveLength(3)
	} finally {
		jest.useRealTimers()
	}
})

test("a failed mutate request toasts and still schedules a reload", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useTasks())
		await resolveList([task(1, true)])

		act(() => { result.current[1](1) })

		const call = calls.find((c) => c.url === "/task/start")
		expect(call).toBeDefined()

		await act(async () => {
			call.resolve({ ok: false })
			await Promise.resolve()
		})
		expect(toast).toHaveBeenCalledWith("Couldn't restart task")

		act(() => { jest.advanceTimersByTime(1500) })
		expect(listCalls().length).toBeGreaterThan(1)
	} finally {
		jest.useRealTimers()
	}
})

test("a successful mutate request does not toast", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useTasks())
		await resolveList([task(1, true)])

		act(() => { result.current[2](1) })

		const call = calls.find((c) => c.url === "/task/stop")
		await act(async () => {
			call.resolve({ ok: true })
			await Promise.resolve()
		})
		expect(toast).not.toHaveBeenCalled()
	} finally {
		jest.useRealTimers()
	}
})
