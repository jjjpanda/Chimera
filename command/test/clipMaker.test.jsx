/** @jest-environment jsdom */

jest.mock("../frontend/hooks/useCameras.js", () => ({
	__esModule: true,
	default: () => [[{ id: 101, name: "CamA" }, { id: 102, name: "CamB" }], false]
}))

jest.mock("react-responsive", () => ({ useMediaQuery: () => true }))

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

const React = require("react")
const { render, screen, act } = require("@testing-library/react")
const { MemoryRouter } = require("react-router-dom")
const ClipMaker = require("../frontend/app/ClipMaker.jsx").default
const { __calls: calls } = require("../frontend/js/request.js")

class FakeImage {
	constructor() {
		FakeImage.instances.push(this)
	}
}
FakeImage.instances = []

const resolveCall = (urlSubstr, matcher, data) => {
	const call = calls.find(c => !c.resolved && c.url.includes(urlSubstr) && matcher(c))
	if (!call) throw new Error(`no unresolved call found for ${urlSubstr}`)
	call.resolved = true
	call.resolve(data)
}

const resolveDetections = (camId) => act(async () => {
	resolveCall("/object/detections", (c) => c.url.includes(`camera=${camId}`), [])
	await Promise.resolve()
})

const resolveFrames = (camId, list) => act(async () => {
	resolveCall("/convert/listFramesVideo", (c) => JSON.parse(c.opts.body).camera === String(camId), { list })
	await Promise.resolve()
})

const settleAllImages = () => act(async () => {
	FakeImage.instances.forEach(img => img.onload && img.onload())
	await Promise.resolve()
})

beforeEach(() => {
	calls.length = 0
	FakeImage.instances = []
	global.Image = FakeImage
})

const framesFor = (n, camId) => Array.from({ length: n }, (_, i) => `/frame-${camId}-${i}.jpg`)

test("multi-cam loading finishes even when one camera has more frames than the concurrent-decode cap", async () => {
	const future = { v7_startTransition: true, v7_relativeSplatPath: true }
	render(React.createElement(MemoryRouter, { future }, React.createElement(ClipMaker)))

	await act(async () => { screen.getByLabelText("Switch to multi-camera").click() })
	await act(async () => { screen.getByText("CamA").click() })
	await act(async () => { screen.getByText("CamB").click() })
	await act(async () => { screen.getByText("Load Images").click() })

	// Camera A resolves first with more frames than MAX_CONCURRENT_DECODES (24),
	// so its decode queue is still mid-flight when camera B resolves and re-triggers the shared effect.
	await resolveDetections(101)
	await resolveFrames(101, framesFor(30, 101))
	await resolveDetections(102)
	await resolveFrames(102, framesFor(3, 102))

	await settleAllImages()
	await settleAllImages()

	expect(screen.getByText("Reload Images")).toBeTruthy()
	expect(screen.queryByText("Loading…")).toBeNull()
})
