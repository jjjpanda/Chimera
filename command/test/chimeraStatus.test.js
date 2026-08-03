/** @jest-environment jsdom */

jest.mock("../frontend/hooks/useCameras.js", () => {
	const cameras = []
	return { __esModule: true, default: () => [cameras, false] }
})

jest.mock("../frontend/js/request.js", () => ({
	request: jest.fn(),
	statusProcessing: jest.fn(),
	jsonProcessing: jest.fn()
}))

const { renderHook, act } = require("@testing-library/react")
const { request } = require("../frontend/js/request.js")
const useChimeraStatus = require("../frontend/hooks/useChimeraStatus.js").default

describe("useChimeraStatus", () => {
	beforeEach(() => jest.useFakeTimers())
	afterEach(() => jest.useRealTimers())

	test("requests every status url once on mount", () => {
		renderHook(() => useChimeraStatus())
		expect(request).toHaveBeenCalledTimes(8)
	})

	test("re-polls every 5 seconds", () => {
		renderHook(() => useChimeraStatus())
		request.mockClear()
		act(() => jest.advanceTimersByTime(5000))
		expect(request).toHaveBeenCalledTimes(8)
		act(() => jest.advanceTimersByTime(5000))
		expect(request).toHaveBeenCalledTimes(16)
	})

	test("clears the interval on unmount so no poll fires afterwards", () => {
		const { unmount } = renderHook(() => useChimeraStatus())
		unmount()
		request.mockClear()
		act(() => jest.advanceTimersByTime(20000))
		expect(request).not.toHaveBeenCalled()
	})

	const deferredPolls = () => {
		const { statusProcessing } = require("../frontend/js/request.js")
		statusProcessing.mockImplementation((prom, code, cb) => prom.then((res) => cb(res.status === code)))

		const resolvers = []
		request.mockImplementation((url, opt, callback) => {
			callback(new Promise((resolve) => resolvers.push(resolve)))
		})
		return resolvers
	}

	const settle = (resolve, status) => act(async () => {
		resolve({ status })
		await Promise.resolve()
	})

	test("a stale response from an earlier poll cannot overwrite a fresher one", async () => {
		const resolvers = deferredPolls()
		const { result } = renderHook(() => useChimeraStatus())
		act(() => jest.advanceTimersByTime(5000))

		await settle(resolvers[8], 200)
		await settle(resolvers[0], 500)

		expect(result.current[0].command).toBe("up")
	})

	test("a response slower than the poll interval still applies, so the tile does not starve at loading", async () => {
		const resolvers = deferredPolls()
		const { result } = renderHook(() => useChimeraStatus())
		act(() => jest.advanceTimersByTime(5000))
		expect(result.current[0].command).toBe("loading")

		await settle(resolvers[0], 200)

		expect(result.current[0].command).toBe("up")
	})
})
