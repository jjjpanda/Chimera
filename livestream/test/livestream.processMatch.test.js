const supertest = require("supertest")

jest.mock("pm2", () => ({
	list: (callback) => callback(null, [
		{ name: "live_stream_cam_7", pm2_env: { status: "stopped", restart_time: 4 } },
		{ name: "live_stream_cam_10", pm2_env: { status: "online", restart_time: 0 } }
	]),
	restart: (processName, callback) => callback(null, { name: processName })
}))
jest.mock("memory")
jest.mock("lib")
jest.mock("axios")

const app = require("../backend/livestream.js")

describe("status process matching", () => {
	const cookie = "validCookie"

	// live_stream_cam_1 is a prefix of live_stream_cam_10, so a substring match made camera 1 track camera 10
	test("a camera reports 204 when only a higher-numbered camera shares its prefix", (done) => {
		supertest(app)
			.get("/livestream/status?camera=1")
			.set("Cookie", cookie)
			.expect(204, {}, done)
	})

	test("a camera still matches its own process exactly", (done) => {
		supertest(app)
			.get("/livestream/status?camera=10")
			.set("Cookie", cookie)
			.expect(200, [{ name: "live_stream_cam_10", status: "online", restarts: 0 }], done)
	})

	test("the unfiltered list keeps every camera — the prefix still matches the whole family", (done) => {
		supertest(app)
			.get("/livestream/status")
			.set("Cookie", cookie)
			.expect(200, [
				{ name: "live_stream_cam_7", status: "stopped", restarts: 4 },
				{ name: "live_stream_cam_10", status: "online", restarts: 0 }
			], done)
	})

	// the route reports presence, not health — the caller has to read the status field
	test("a stopped process is still listed, carrying its real pm2 status", (done) => {
		supertest(app)
			.get("/livestream/status?camera=7")
			.set("Cookie", cookie)
			.expect(200, [{ name: "live_stream_cam_7", status: "stopped", restarts: 4 }], done)
	})
})
