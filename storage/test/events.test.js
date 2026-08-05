process.env.storage_FOLDERPATH = "/tmp/storage-events-test"

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")
jest.mock("pg", () => {
	const { EventEmitter } = require("events")
	const pools = []
	const Pool = jest.fn((config) => {
		const query = jest.fn((sql) =>
			Promise.resolve(/COUNT/.test(sql) ? { rows: [{ count: "0" }] } : { rows: [] })
		)
		const release = jest.fn()
		const client = Object.assign(new EventEmitter(), { query, release })
		const pool = { config, query, release, client, connect: jest.fn(() => Promise.resolve(client)), on: jest.fn() }
		pools.push(pool)
		return pool
	})
	return { Pool, __pools: pools }
})

const supertest = require("supertest")
const lib = require("lib")
const fs = require("fs")
const pm2 = require("pm2")
const app = require("../backend/storage.js")

const { BULK_TIMEOUT_MS } = require("../backend/lib/pool.js")
const pools = require("pg").__pools
const requestPool = pools.find((p) => p.config.statement_timeout !== BULK_TIMEOUT_MS)
const bulkPool = pools.find((p) => p.config.statement_timeout === BULK_TIMEOUT_MS)
const { query } = requestPool
const { query: bulkQuery } = bulkPool

const bulkSql = () => bulkQuery.mock.calls.map((c) => typeof c[0] === "string" ? c[0] : c[0].text)

const rawGet = (rawPath) => new Promise((resolve, reject) => {
	const http = require("http")
	const server = http.createServer(app).listen(0, "127.0.0.1", () => {
		http.get({
			port: server.address().port,
			path: rawPath,
			headers: { Cookie: "validCookie" }
		}, (res) => {
			let raw = ""
			res.on("data", (chunk) => { raw += chunk })
			res.on("end", () => server.close(() => resolve({
				status: res.statusCode,
				body: raw && /json/.test(res.headers["content-type"] || "") ? JSON.parse(raw) : {}
			})))
		}).on("error", (err) => server.close(() => reject(err)))
	})
})

const defaultAuthorize = lib.auth.authorize.getMockImplementation()

beforeEach(() => {
	delete process.env.storage_MAX_GB
})

afterEach(() => {
	lib.auth.authorize.mockImplementation(defaultAuthorize)
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
			expect(res.body).toEqual({ deleted: true, motionRestarted: true })
		})

		test("restarts motion so the deleted camera does not resurrect", async () => {
			await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(pm2.restart).toHaveBeenCalledWith("motion", expect.any(Function))
		})

		test("reports motionRestarted:false without claiming full success when the restart fails", async () => {
			pm2.restart.mockImplementationOnce((name, cb) => cb(new Error("pm2 busy")))
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(502)
			expect(res.body).toEqual({ deleted: true, motionRestarted: false })
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
			expect(res.body).toEqual({ error: true, motionRestarted: false })
			expect(fs.promises.rm).not.toHaveBeenCalled()
			expect(bulkQuery).not.toHaveBeenCalled()
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

		test("wipes both tables in one transaction, once every file for the camera is already gone", async () => {
			fs.promises.readdir.mockImplementation((p) =>
				Promise.resolve(String(p).includes("objectCaptures") ? ["1-100.jpg"] : []))
			await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(bulkSql()).toEqual([
				"BEGIN",
				"DELETE FROM frame_files WHERE camera = $1",
				"DELETE FROM objects_detected WHERE camera = $1",
				"COMMIT"
			])
			expect(fs.promises.rm.mock.invocationCallOrder[0]).toBeLessThan(bulkQuery.mock.invocationCallOrder[0])
			expect(fs.promises.unlink.mock.invocationCallOrder.at(-1)).toBeLessThan(bulkQuery.mock.invocationCallOrder[0])
		})

		test("removes the conf and restarts motion before the deferrable file removal, so a mid-run defer cannot leave the camera recording", async () => {
			lib.cameraConfFiles.mockResolvedValueOnce(["/etc/motion/cameraconf/frontdoor.conf"])
			await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(fs.promises.unlink.mock.invocationCallOrder[0]).toBeLessThan(pm2.restart.mock.invocationCallOrder[0])
			expect(pm2.restart.mock.invocationCallOrder[0]).toBeLessThan(fs.promises.rm.mock.invocationCallOrder[0])
		})

		test("runs the deletes on the bulk pool, whose budget outlasts the request pool's", async () => {
			await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(query).not.toHaveBeenCalled()
			expect(bulkPool.config.statement_timeout).toBeGreaterThan(requestPool.config.statement_timeout)
			expect(bulkPool.config.query_timeout).toBeGreaterThan(bulkPool.config.statement_timeout)
		})

		test("gives up on a saturated bulk pool long before the query budget, so a request cannot hang for the whole delete window", () => {
			expect(bulkPool.config.connectionTimeoutMillis).toBeLessThan(bulkPool.config.statement_timeout)
			expect(bulkPool.config.connectionTimeoutMillis).toBeLessThanOrEqual(requestPool.config.statement_timeout)
		})

		test("defers instead of deleting frames an export of that camera is still reading", async () => {
			fs.promises.readdir.mockImplementation((p) =>
				Promise.resolve(p.endsWith("captures") ? ["mp4_1_abc.txt"] : []))
			fs.promises.stat = jest.fn().mockResolvedValue({ mtimeMs: Date.now() })
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ deferred: true })
			expect(fs.promises.rm).not.toHaveBeenCalled()
			expect(bulkQuery).not.toHaveBeenCalled()
			expect(pm2.restart).not.toHaveBeenCalled()
		})

		test("proceeds when the live export belongs to a different camera", async () => {
			fs.promises.readdir.mockImplementation((p) =>
				Promise.resolve(p.endsWith("captures") ? ["mp4_2_abc.txt"] : []))
			fs.promises.stat = jest.fn().mockResolvedValue({ mtimeMs: Date.now() })
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ deleted: true, motionRestarted: true })
			expect(fs.promises.rm).toHaveBeenCalled()
		})

		test("finishes the camera teardown when an export starts after the pre-check, leaving frame_files rows until the delete is retried", async () => {
			const frames = Array.from({ length: 600 }, (_, i) => `2020010${i % 10}-000000-00.jpg`)
			let lockChecks = 0
			fs.promises.readdir.mockImplementation((p) => {
				if (!p.endsWith("captures")) return Promise.resolve(frames)
				lockChecks++
				return Promise.resolve(lockChecks <= 2 ? [] : ["mp4_1_abc.txt"])
			})
			fs.promises.stat = jest.fn().mockResolvedValue({ mtimeMs: Date.now() })
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ deleted: true, motionRestarted: true, deferred: true })
			expect(fs.promises.unlink).toHaveBeenCalledTimes(500)
			expect(fs.promises.rm).not.toHaveBeenCalled()
			expect(bulkSql()).toEqual([
				"BEGIN",
				"DELETE FROM objects_detected WHERE camera = $1",
				"COMMIT"
			])
			expect(pm2.restart).toHaveBeenCalledWith("motion", expect.any(Function))
		})

		test("returns 500 and rolls back when the frame_files wipe fails after the captures directory is already gone", async () => {
			fs.promises.readdir.mockImplementation((p) =>
				Promise.resolve(p.endsWith("captures") ? [] : ["a.jpg", "b.jpg"]))
			bulkQuery
				.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				.mockImplementationOnce(() => Promise.reject(new Error("deadlock detected")))
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true, motionRestarted: true })
			expect(bulkSql()).toEqual([
				"BEGIN",
				"DELETE FROM frame_files WHERE camera = $1",
				"ROLLBACK"
			])
			expect(fs.promises.rm).toHaveBeenCalled()
		})

		test("returns 500 when the captures directory cannot be removed, leaving the frame_files rows in place until removal succeeds", async () => {
			fs.promises.rm.mockRejectedValueOnce(Object.assign(new Error("EACCES"), { code: "EACCES" }))
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(500)
			expect(bulkQuery).not.toHaveBeenCalled()
			expect(pm2.restart).toHaveBeenCalledWith("motion", expect.any(Function))
		})

		test("stops the camera and clears the captures directory before the frame_files delete, so a wipe failure still leaves motion restarted", async () => {
			bulkQuery
				.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				.mockImplementationOnce(() => Promise.reject(new Error("deadlock detected")))
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(500)
			expect(bulkSql()).not.toContain("DELETE FROM objects_detected WHERE camera = $1")
			expect(pm2.restart).toHaveBeenCalledWith("motion", expect.any(Function))
			expect(fs.promises.rm).toHaveBeenCalled()
		})

		test("rolls the frame_files wipe back when the objects_detected delete fails, so a retry can clear both", async () => {
			bulkQuery
				.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				.mockImplementationOnce(() => Promise.reject(new Error("deadlock detected")))
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(500)
			expect(bulkSql()).toEqual([
				"BEGIN",
				"DELETE FROM frame_files WHERE camera = $1",
				"DELETE FROM objects_detected WHERE camera = $1",
				"ROLLBACK"
			])
			expect(fs.promises.rm).toHaveBeenCalled()
		})

		test("clears objects_detected rows and prefixed objectCaptures files", async () => {
			fs.promises.readdir.mockImplementation((p) =>
				Promise.resolve(p.includes("objectCaptures") ? ["1-100.jpg", "1-200.jpg", "12-300.jpg", "2-400.jpg"] : []))
			const res = await supertest(app)
				.delete("/camera/1")
				.set("Cookie", "validCookie")
			expect(res.status).toBe(200)
			expect(bulkQuery).toHaveBeenCalledWith("DELETE FROM objects_detected WHERE camera = $1", ["1"])
			const unlinked = fs.promises.unlink.mock.calls.map((c) => c[0])
			expect(unlinked).toHaveLength(2)
			expect(unlinked.some((p) => p.endsWith("1-100.jpg"))).toBe(true)
			expect(unlinked.some((p) => p.endsWith("1-200.jpg"))).toBe(true)
		})
	})

	describe("GET /frames/:camera_id/:filename", () => {
		test("returns 400 for path traversal attempt", async () => {
			const res = await rawGet("/frames/%2e%2e/evil")
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

		test("aggregates on the request pool, so a slow page load fails fast instead of queueing behind a bulk delete", async () => {
			await supertest(app)
				.get("/usage")
				.set("Cookie", "validCookie")
			expect(query.mock.calls[0][0]).toMatch(/SUM\(size\).+FROM frame_files GROUP BY camera/)
			expect(bulkQuery).not.toHaveBeenCalled()
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
