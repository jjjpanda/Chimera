/** @jest-environment jsdom */

jest.mock("../frontend/hooks/useCameras.js", () => {
	const cameras = [{ id: 1, name: "front" }]
	return { __esModule: true, default: () => [cameras, false] }
})

jest.mock("../frontend/js/request.js", () => ({
	...jest.requireActual("../frontend/js/request.js"),
	request: jest.fn()
}))

const { renderHook, act } = require("@testing-library/react")
const { request } = require("../frontend/js/request.js")
const useChimeraStatus = require("../frontend/hooks/useChimeraStatus.js").default

const respond = (status, body) => {
	request.mockImplementation((url, opt, callback) => callback(Promise.resolve(
		url.startsWith("/livestream/status?")
			? { status, text: () => Promise.resolve(body) }
			: { status: 500, text: () => Promise.resolve("") }
	)))
}

const flush = () => act(async () => {
	for (let i = 0; i < 5; i++) await Promise.resolve()
})

describe("useChimeraStatus camera dots", () => {
	let unmount

	afterEach(() => unmount && unmount())

	const render = async () => {
		const hook = renderHook(() => useChimeraStatus())
		unmount = hook.unmount
		await flush()
		return hook.result
	}

	test("up when the camera's process is online", async () => {
		respond(200, JSON.stringify([{ name: "live_stream_cam_1", status: "online", restarts: 0 }]))
		const result = await render()
		expect(result.current[0]["cam front"]).toBe("up")
	})

	// pm2.list keeps stopped and errored processes, so a 200 alone says nothing about the stream
	test("down when the process is listed but stopped", async () => {
		respond(200, JSON.stringify([{ name: "live_stream_cam_1", status: "stopped", restarts: 12 }]))
		const result = await render()
		expect(result.current[0]["cam front"]).toBe("down")
	})

	test("down when no process exists at all", async () => {
		respond(204, "{}")
		const result = await render()
		expect(result.current[0]["cam front"]).toBe("down")
	})
})
