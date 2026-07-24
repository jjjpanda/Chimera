/** @jest-environment jsdom */

jest.mock("../frontend/hooks/useCameras.js", () => {
	const cameras = []
	return { __esModule: true, default: () => [cameras, false] }
})

jest.mock("../frontend/js/request.js", () => ({
	request: jest.fn(),
	statusProcessing: jest.fn()
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
})
