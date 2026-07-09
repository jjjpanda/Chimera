process.env.storage_FOLDERPATH = "/tmp/storage-events-test"

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")
jest.mock("pg", () => {
	const query = jest.fn((sql) =>
		Promise.resolve(/COUNT/.test(sql) ? { rows: [{ count: "0" }] } : { rows: [] })
	)
	return { Pool: jest.fn(() => ({ query, on: jest.fn() })), __query: query }
})

const supertest = require("supertest")
const lib = require("lib")
const { __query: query } = require("pg")
const fs = require("fs")
const app = require("../backend/storage.js")

const defaultAuthorize = lib.auth.authorize.getMockImplementation()

beforeEach(() => {
	delete process.env.storage_MAX_GB
})

afterEach(() => {
	lib.auth.authorize.mockImplementation(defaultAuthorize)
	query.mockClear()
})

describe("Events Routes", () => {
	describe("GET /events", () => {
		test("redirects unauthorized request", (done) => {
			supertest(app).get("/events").expect(303, done)
		})

		test("returns 400 when camera_id or date missing", async () => {
			const res = await supertest(app)
				.get("/events")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(400)
		})

		test("returns paginated events for authorized request", async () => {
			const res = await supertest(app)
				.get("/events?camera_id=1&date=2026-05-16")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ events: [], total: 0, page: 1, per_page: 100 })
		})

		test("queries a sargable half-open date range, not DATE(timestamp)", async () => {
			await supertest(app)
				.get("/events?camera_id=7&date=2026-05-16")
				.set("Cookie", "validCookie")
			const [dataSql, dataParams] = query.mock.calls[0]
			expect(dataSql).toMatch(/timestamp >= \(\$2::date AT TIME ZONE 'UTC'\)/)
			expect(dataSql).toMatch(/< \(\(\$2::date \+ INTERVAL '1 day'\) AT TIME ZONE 'UTC'\)/)
			expect(dataSql).not.toMatch(/DATE\(/)
			expect(dataParams).toEqual(["7", "2026-05-16", 100, 0])
		})
	})

	describe("requireAdmin gating", () => {
		test("DELETE /camera/:id returns 403 for non-admin", async () => {
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "userCookie")
			expect(res.status).toBe(403)
		})
	})

	describe("DELETE /camera/:id", () => {
		let origPromises
		beforeEach(() => {
			lib.auth.authorize.mockImplementation((req, res, next) => {
				req.decoded = { role: "admin" }
				next()
			})
			origPromises = fs.promises
			fs.promises = {
				rm: jest.fn().mockResolvedValue(undefined),
				readdir: jest.fn().mockResolvedValue([]),
				unlink: jest.fn().mockResolvedValue(undefined)
			}
		})
		afterEach(() => {
			fs.promises = origPromises
		})

		test("deletes camera data and returns success", async () => {
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ deleted: true })
		})

		test("returns 400 for non-numeric id", async () => {
			const res = await supertest(app)
				.delete("/camera/abc")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(400)
		})

		test("returns 500 without destroying anything when the camera confs are unreadable", async () => {
			lib.cameraConfFiles.mockRejectedValueOnce(Object.assign(new Error("EACCES"), { code: "EACCES" }))
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
			expect(fs.promises.rm).not.toHaveBeenCalled()
			expect(query).not.toHaveBeenCalled()
		})

		test("removes the camera's .conf (matched by camera_id, any filename) so it does not resurrect on reload", async () => {
			lib.cameraConfFiles.mockResolvedValueOnce(["/etc/motion/cameraconf/frontdoor.conf"])
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(lib.cameraConfFiles).toHaveBeenCalledWith("1")
			const unlinked = fs.promises.unlink.mock.calls.map((c) => c[0])
			expect(unlinked).toContain("/etc/motion/cameraconf/frontdoor.conf")
		})

		test("clears objects_detected rows and prefixed objectCaptures files", async () => {
			fs.promises.readdir.mockResolvedValueOnce(["1-100.jpg", "1-200.jpg", "12-300.jpg", "2-400.jpg"])
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(query).toHaveBeenCalledWith("DELETE FROM objects_detected WHERE camera = $1", ["1"])
			const unlinked = fs.promises.unlink.mock.calls.map((c) => c[0])
			expect(unlinked).toHaveLength(2)
			expect(unlinked.some((p) => p.endsWith("1-100.jpg"))).toBe(true)
			expect(unlinked.some((p) => p.endsWith("1-200.jpg"))).toBe(true)
		})
	})

	describe("GET /frames/:camera_id/:filename", () => {
		test("returns 400 for path traversal attempt", async () => {
			const res = await supertest(app)
				.get("/frames/%2e%2e/evil")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(400)
		})

		test("returns 400 for a filename containing ..", async () => {
			const res = await supertest(app)
				.get("/frames/1/a..b.jpg")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(400)
			expect(res.body).toEqual({ error: "invalid filename" })
		})

		test("returns 404 when file not found", async () => {
			const express = require("express")
			const origSendFile = express.response.sendFile
			express.response.sendFile = function(_path, cb) {
				if (cb) cb(Object.assign(new Error("ENOENT"), { code: "ENOENT", status: 404 }))
			}
			try {
				const res = await supertest(app)
					.get("/frames/1/test.jpg")
					.set("Cookie", "validCookie")
				expect(res.status).toBe(404)
			} finally {
				express.response.sendFile = origSendFile
			}
		})
	})

	describe("GET /usage", () => {
		let readdirSpy, statSpy
		beforeEach(() => {
			lib.auth.authorize.mockImplementation((req, res, next) => {
				req.decoded = { role: "admin" }
				next()
			})
			readdirSpy = jest.spyOn(fs.promises, "readdir").mockImplementation((p) =>
				Promise.resolve(String(p).endsWith("objectCaptures")
					? [{ name: "1-a.jpg", isFile: () => true }]
					: []))
			statSpy = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 500000000 })
		})

		afterEach(() => {
			readdirSpy.mockRestore()
			statSpy.mockRestore()
		})

		test("returns usage stats", async () => {
			const res = await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body).toMatchObject({ used_gb: 0.5, max_gb: 0, cameras: [], total_frames: 0 })
		})

		test("returns 500 when the camera confs are unreadable instead of reporting zero cameras", async () => {
			lib.loadCameras.mockRejectedValueOnce(Object.assign(new Error("EACCES"), { code: "EACCES" }))
			const res = await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
			expect(query).not.toHaveBeenCalled()
		})

		test("includes a per-category byte breakdown", async () => {
			const res = await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body.breakdown).toEqual({
				frames: 0, videos: 0, zips: 0, objects: 500000000, other: 0
			})
		})

		test("sources frame bytes from the DB, independent of top-level mp4/zip/other files", async () => {
			query.mockResolvedValueOnce({ rows: [{ camera: "1", count: "3", bytes: "500000000" }] })
			readdirSpy.mockImplementation((p) => Promise.resolve(String(p).endsWith("objectCaptures") ? [] : [
				{ name: "clip.mp4", isFile: () => true },
				{ name: "bundle.zip", isFile: () => true },
				{ name: "notes.txt", isFile: () => true },
				{ name: "1", isFile: () => false }
			]))
			statSpy.mockImplementation((p) => Promise.resolve({
				size: String(p).endsWith("clip.mp4") ? 100 : String(p).endsWith("bundle.zip") ? 50 : 25
			}))
			const res = await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body.breakdown).toEqual({
				frames: 500000000, videos: 100, zips: 50, objects: 0, other: 25
			})
		})

		test("aggregates per-camera stats when cameras are configured", async () => {
			lib.loadCameras.mockResolvedValueOnce([{ id: 1, name: "Front" }, { id: 2, name: "Back" }])
			query.mockResolvedValueOnce({ rows: [
				{ camera: "1", count: "3", bytes: "500000000" },
				{ camera: "2", count: "2", bytes: "250000000" }
			] })
			const res = await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body.cameras).toEqual([
				{ id: 1, name: "Front", used_gb: 0.5, frame_count: 3 },
				{ id: 2, name: "Back", used_gb: 0.25, frame_count: 2 }
			])
		})

		test("returns 500 on db error", async () => {
			query.mockRejectedValueOnce(new Error("db error"))
			const res = await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(500)
		})
	})
})
