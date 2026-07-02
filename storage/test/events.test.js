process.env.storage_FOLDERPATH = "/tmp/storage-events-test"

jest.mock("lib")
jest.mock("fs")
jest.mock("child_process")
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
const { execFile } = require("child_process")
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
		beforeEach(() => {
			lib.auth.authorize.mockImplementation((req, res, next) => {
				req.decoded = { role: "admin" }
				next()
			})
			execFile.mockImplementation((_cmd, _args, cb) => cb(null, "500000000\t/path\n"))
		})

		afterEach(() => {
			execFile.mockReset()
		})

		test("returns usage stats", async () => {
			const res = await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body).toMatchObject({ used_gb: 1, max_gb: 0, cameras: [], total_frames: 0 })
		})

		test("includes a per-category byte breakdown", async () => {
			const res = await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body.breakdown).toEqual({
				frames: 500000000, videos: 0, zips: 0, objects: 500000000, other: 0
			})
		})

		test("categorizes top-level mp4/zip/other files and subtracts them from frames", async () => {
			const readdir = jest.spyOn(fs.promises, "readdir").mockResolvedValue([
				{ name: "clip.mp4", isFile: () => true },
				{ name: "bundle.zip", isFile: () => true },
				{ name: "notes.txt", isFile: () => true },
				{ name: "1", isFile: () => false }
			])
			const stat = jest.spyOn(fs.promises, "stat").mockImplementation((p) => Promise.resolve({
				size: p.endsWith("clip.mp4") ? 100 : p.endsWith("bundle.zip") ? 50 : 25
			}))
			try {
				const res = await supertest(app)
					.get("/usage")
					.set("Cookie", "validCookie")
				expect(res.status).toBe(200)
				expect(res.body.breakdown).toEqual({
					frames: 500000000 - 175, videos: 100, zips: 50, objects: 500000000, other: 25
				})
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
			}
		})

		test("aggregates per-camera stats when cameras are configured", async () => {
			lib.loadCameras.mockReturnValueOnce([{ id: 1, name: "Front" }, { id: 2, name: "Back" }])
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
