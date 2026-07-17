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
const useLiveVideo = require("../frontend/hooks/useLiveVideo.js").default
const { __calls: calls } = require("../frontend/js/request.js")

const cameras = [{ id: 1, name: "Front Door" }, { id: 2, name: "Driveway" }]

const stream = (num, status, restarts = 0) => ({ name: `live_stream_cam_${num}`, status, restarts })

const resolveStatus = (data) => act(async () => {
	const call = calls.find((c) => !c.resolved && c.url === "/livestream/status")
	if (!call) throw new Error("no unresolved /livestream/status call")
	call.resolved = true
	call.resolve(data)
	await Promise.resolve()
})

const statusCalls = () => calls.filter((c) => c.url === "/livestream/status")

beforeEach(() => { calls.length = 0 })

test("only pm2's online status marks a stream online", async () => {
	const { result } = renderHook(() => useLiveVideo(cameras))

	await resolveStatus([stream(1, "online"), stream(2, "stopped")])

	expect(result.current[0].videoList.map((v) => [v.camera, v.online])).toEqual([
		["Front Door", true],
		["Driveway", false]
	])
})

test("a stream is offline for every non-online pm2 status", async () => {
	const { result } = renderHook(() => useLiveVideo(cameras))

	await resolveStatus([stream(1, "errored"), stream(2, "launching")])

	expect(result.current[0].videoList.every((v) => !v.online)).toBe(true)
})

test("restarts and feed url come through per camera, sorted by camera number", async () => {
	const { result } = renderHook(() => useLiveVideo(cameras))

	await resolveStatus([stream(2, "online", 7), stream(1, "stopped", 3)])

	expect(result.current[0].videoList).toEqual([
		{ camera: "Front Door", online: false, restarts: 3, url: "/livestream/feed/1/video.m3u8" },
		{ camera: "Driveway", online: true, restarts: 7, url: "/livestream/feed/2/video.m3u8" }
	])
})

test("a stream with no configured camera falls back to its number", async () => {
	const { result } = renderHook(() => useLiveVideo(cameras))

	await resolveStatus([stream(9, "online")])

	expect(result.current[0].videoList[0].camera).toBe("Camera 9")
})

test("a non-array status body yields an empty list rather than throwing", async () => {
	const { result } = renderHook(() => useLiveVideo(cameras))

	await resolveStatus(undefined)

	expect(result.current[0].videoList).toEqual([])
	expect(result.current[0].loading).toBe(false)
})

test("status is polled every 5s and the poll stops on unmount", () => {
	jest.useFakeTimers()
	try {
		const { unmount } = renderHook(() => useLiveVideo(cameras))
		expect(statusCalls()).toHaveLength(1)

		act(() => { jest.advanceTimersByTime(5000) })
		expect(statusCalls()).toHaveLength(2)

		act(() => { jest.advanceTimersByTime(10000) })
		expect(statusCalls()).toHaveLength(4)

		unmount()
		act(() => { jest.advanceTimersByTime(15000) })
		expect(statusCalls()).toHaveLength(4)
	} finally {
		jest.useRealTimers()
	}
})

test("a slow poll response cannot overwrite a newer one", async () => {
	jest.useFakeTimers()
	try {
		const { result } = renderHook(() => useLiveVideo(cameras))
		act(() => { jest.advanceTimersByTime(5000) })

		const [first, second] = statusCalls()
		await act(async () => {
			second.resolve([stream(1, "online")])
			await Promise.resolve()
			first.resolve([stream(1, "stopped")])
			await Promise.resolve()
		})

		expect(result.current[0].videoList[0].online).toBe(true)
	} finally {
		jest.useRealTimers()
	}
})
