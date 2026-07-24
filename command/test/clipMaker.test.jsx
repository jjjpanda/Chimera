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
const { render, screen, act, fireEvent } = require("@testing-library/react")
const { MemoryRouter } = require("react-router-dom")
const ClipMaker = require("../frontend/app/ClipMaker.jsx").default
const { __calls: calls } = require("../frontend/js/request.js")

class FakeImage {
	constructor() {
		FakeImage.instances.push(this)
	}
}
FakeImage.instances = []

const drawnUrls = []
HTMLCanvasElement.prototype.getContext = () => ({ drawImage: (img) => drawnUrls.push(img.src) })

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

const settleAllImages = (skip = () => false) => act(async () => {
	FakeImage.instances.forEach((img, i) => { if (!skip(i) && img.onload) img.onload() })
	await Promise.resolve()
})

// decoded images report their intrinsic size, so the canvas draw effect gets past its `complete` guard
const decodeAllImages = () => act(async () => {
	FakeImage.instances.forEach(img => {
		if (!img.onload) return
		img.complete = true
		img.naturalWidth = 640
		img.naturalHeight = 360
		img.onload()
	})
	await Promise.resolve()
})

beforeEach(() => {
	calls.length = 0
	drawnUrls.length = 0
	FakeImage.instances = []
	global.Image = FakeImage
})

const framesFor = (n, camId) => Array.from({ length: n }, (_, i) => `/frame-${camId}-${i}.jpg`)

// parseFrameTime only reads YYYYMMDD-HHmmss names, so timed frames are needed to scrub between them
const timedFramesFor = (n) => Array.from({ length: n }, (_, i) => `/20240101-0000${String(i).padStart(2, "0")}.jpg`)

const renderClipMaker = (wrap = (el) => el) => {
	const future = { v7_startTransition: true, v7_relativeSplatPath: true }
	return render(wrap(React.createElement(MemoryRouter, { future }, React.createElement(ClipMaker))))
}

test("decodes still start after StrictMode's remount", async () => {
	renderClipMaker(el => React.createElement(React.StrictMode, null, el))

	await act(async () => { screen.getByLabelText("Switch to multi-camera").click() })
	await act(async () => { screen.getByText("CamA").click() })
	await act(async () => { screen.getByText("Load Images").click() })

	await resolveDetections(101)
	await resolveFrames(101, framesFor(3, 101))

	expect(FakeImage.instances.length).toBeGreaterThan(0)

	await settleAllImages()

	expect(screen.queryByText("Loading…")).toBeNull()
})

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

test("decodes abandoned by a stop never settle against the next load", async () => {
	const { container } = renderClipMaker()

	await act(async () => { screen.getByLabelText("Switch to multi-camera").click() })
	await act(async () => { screen.getByText("CamA").click() })
	await act(async () => { screen.getByText("Load Images").click() })

	await resolveDetections(101)
	await resolveFrames(101, framesFor(30, 101))
	const abandoned = [...FakeImage.instances]

	const stop = [...container.querySelectorAll("button")].find(b => b.querySelector("svg.lucide-square"))
	await act(async () => { stop.click() })

	await act(async () => { screen.getByText("Load Images").click() })
	await resolveDetections(101)
	await resolveFrames(101, framesFor(30, 101))
	const started = FakeImage.instances.length

	// the stopped load's decodes finish late, after the new load has already queued its own
	await act(async () => {
		abandoned.forEach(img => img.onload())
		await Promise.resolve()
	})

	expect(FakeImage.instances).toHaveLength(started)
	expect(screen.queryByText("Loading…")).toBeTruthy()
})

test("a hung decode still times out when a later camera re-triggers the shared effect", async () => {
	jest.useFakeTimers()
	try {
		const future = { v7_startTransition: true, v7_relativeSplatPath: true }
		render(React.createElement(MemoryRouter, { future }, React.createElement(ClipMaker)))

		await act(async () => { screen.getByLabelText("Switch to multi-camera").click() })
		await act(async () => { screen.getByText("CamA").click() })
		await act(async () => { screen.getByText("CamB").click() })
		await act(async () => { screen.getByText("Load Images").click() })

		await resolveDetections(101)
		await resolveFrames(101, framesFor(30, 101))
		await resolveDetections(102)
		await resolveFrames(102, framesFor(3, 102))

		// instance 0 is camera A's first decode: queued before camera B re-ran the effect, and never settles
		await settleAllImages(i => i === 0)
		await settleAllImages(i => i === 0)

		expect(screen.queryByText("Loading…")).toBeTruthy()

		await act(async () => { jest.advanceTimersByTime(10000) })

		expect(screen.queryByText("Loading…")).toBeNull()
	} finally {
		jest.useRealTimers()
	}
})

const loadCamA = async (frames) => {
	renderClipMaker()
	await act(async () => { screen.getByLabelText("Switch to multi-camera").click() })
	await act(async () => { screen.getByText("CamA").click() })
	await act(async () => { screen.getByText("Load Images").click() })
	await resolveDetections(101)
	await resolveFrames(101, frames)
}

const valueNow = (label) => screen.getByLabelText(label).getAttribute("aria-valuenow")

test("scrub thumb moves with the keyboard and clamps at both ends", async () => {
	await loadCamA(framesFor(30, 101))
	await settleAllImages()
	await settleAllImages()

	const thumb = screen.getByLabelText("Scrub position")
	expect(valueNow("Scrub position")).toBe("0")

	fireEvent.keyDown(thumb, { key: "ArrowRight" })
	expect(valueNow("Scrub position")).toBe("1")
	fireEvent.keyDown(thumb, { key: "ArrowUp" })
	expect(valueNow("Scrub position")).toBe("2")
	fireEvent.keyDown(thumb, { key: "PageUp" })
	expect(valueNow("Scrub position")).toBe("12")
	fireEvent.keyDown(thumb, { key: "End" })
	expect(valueNow("Scrub position")).toBe("29")
	fireEvent.keyDown(thumb, { key: "ArrowRight" })
	expect(valueNow("Scrub position")).toBe("29")

	fireEvent.keyDown(thumb, { key: "PageDown" })
	expect(valueNow("Scrub position")).toBe("19")
	fireEvent.keyDown(thumb, { key: "ArrowDown" })
	expect(valueNow("Scrub position")).toBe("18")
	fireEvent.keyDown(thumb, { key: "a" })
	expect(valueNow("Scrub position")).toBe("18")
	fireEvent.keyDown(thumb, { key: "Home" })
	expect(valueNow("Scrub position")).toBe("0")
	fireEvent.keyDown(thumb, { key: "ArrowLeft" })
	expect(valueNow("Scrub position")).toBe("0")
})

test("trim thumbs move with the keyboard and pull the scrub back inside the range", async () => {
	await loadCamA(framesFor(30, 101))
	await settleAllImages()
	await settleAllImages()

	await act(async () => { screen.getByText("Time Zoom").click() })
	const start = screen.getByLabelText("Trim start")
	const end = screen.getByLabelText("Trim end")

	// the scrub sits at frame 0, so every step of the start handle drags it forward
	for (let i = 0; i < 5; i++) fireEvent.keyDown(start, { key: "PageUp" })
	expect(valueNow("Trim start")).toBe("50")
	expect(valueNow("Scrub position")).toBe("15")

	fireEvent.keyDown(screen.getByLabelText("Scrub position"), { key: "End" })
	expect(valueNow("Scrub position")).toBe("29")
	fireEvent.keyDown(end, { key: "PageDown" })
	expect(valueNow("Trim end")).toBe("90")
	expect(valueNow("Scrub position")).toBe("26")

	// Home/End on a handle stop one step short of the other handle
	fireEvent.keyDown(end, { key: "Home" })
	expect(valueNow("Trim end")).toBe("51")
	expect(valueNow("Scrub position")).toBe("15")
	fireEvent.keyDown(start, { key: "End" })
	expect(valueNow("Trim start")).toBe("50")

	fireEvent.keyDown(start, { key: "Home" })
	expect(valueNow("Trim start")).toBe("0")
	fireEvent.keyDown(end, { key: "End" })
	expect(valueNow("Trim end")).toBe("100")
})

test("a canvas cell repaints only when its own frame changes", async () => {
	const [f0, f1] = timedFramesFor(3)
	await loadCamA(timedFramesFor(3))
	await decodeAllImages()

	// three decode settles plus the dims write all re-run the draw effect against the same frame
	expect(drawnUrls).toEqual([f0])

	const thumb = screen.getByLabelText("Scrub position")
	fireEvent.keyDown(thumb, { key: "ArrowRight" })
	expect(drawnUrls).toEqual([f0, f1])
	fireEvent.keyDown(thumb, { key: "ArrowLeft" })
	expect(drawnUrls).toEqual([f0, f1, f0])

	// a reload clears drawnCells, so the same frame must repaint onto the reset canvas
	await act(async () => { screen.getByText("Reload Images").click() })
	await resolveDetections(101)
	await resolveFrames(101, timedFramesFor(3))
	await decodeAllImages()
	expect(drawnUrls).toEqual([f0, f1, f0, f0])
})
