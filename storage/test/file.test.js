const supertest = require("supertest")

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")
jest.mock("axios")
jest.mock("pg", () => {
	const pools = []
	const Pool = jest.fn((config) => {
		const query = jest.fn((sql) =>
			Promise.resolve(/COUNT/.test(sql) ? { rows: [{ count: "0" }] } : { rows: [] })
		)
		const pool = { config, query, connect: jest.fn(), on: jest.fn() }
		pools.push(pool)
		return pool
	})
	return { Pool, __pools: pools }
})

const app = require("../backend/storage.js")
const fs = require("fs")
const path = require("path")
const moment = require("moment")

const { BULK_TIMEOUT_MS } = require("../backend/lib/pool.js")
const { MAX_CONSECUTIVE_DEFERRALS, DEFERRAL_STATE_PATH, FRAME_SWEEP_GRACE_MS, sweepOrphanFrames } = require("../backend/routes/lib/file.js")
const pools = require("pg").__pools
const { query } = pools.find((p) => p.config.statement_timeout !== BULK_TIMEOUT_MS)
const { query: bulkQuery } = pools.find((p) => p.config.statement_timeout === BULK_TIMEOUT_MS)

describe("File Routes", () => {
	let cookieWithBearerToken = "validCookie"

	beforeEach(() => {
		try { fs.unlinkSync(DEFERRAL_STATE_PATH) } catch { /* no deferrals recorded yet */ }
	})

	describe("/file/pathStats", () => {
		const { loadCameras } = require("lib")
		afterEach(() => { loadCameras.mockResolvedValue([]) })

		test("returns 500 when the camera confs are unreadable instead of an empty series", async () => {
			loadCameras.mockRejectedValueOnce(new Error("EACCES"))
			const res = await supertest(app)
				.get("/file/pathStats")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
			expect(query).not.toHaveBeenCalled()
		})

		test("rolls up history on the request pool, so a page load fails fast instead of queueing behind a bulk delete", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "cam1" }])
			query.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			await supertest(app)
				.get("/file/pathStats")
				.set("Cookie", cookieWithBearerToken)
			expect(query.mock.calls[0][0]).toMatch(/date_trunc\('hour', timestamp\).+FROM frame_files WHERE .+GROUP BY 1/)
			expect(bulkQuery).not.toHaveBeenCalled()
		})

		test("bounds the rollup, but wider than the Stats page's 30-day view, which floors its cutoff to local midnight", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "cam1" }])
			query.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			await supertest(app)
				.get("/file/pathStats")
				.set("Cookie", cookieWithBearerToken)
			const [, days] = query.mock.calls[0][0].match(/WHERE timestamp >= NOW\(\) - INTERVAL '(\d+) days'/)
			expect(parseInt(days)).toBeGreaterThan(30)
		})
	})

	describe("/file/pathSize", () => {
		test("bruh", () => expect(2+2).toBe(4))
	})

	describe("/file/pathFileCount", () => {
		test("bruh", () => expect(2+2).toBe(4))
	})

	describe("/file/pathMetrics", () => {
		const { loadCameras } = require("lib")
		afterEach(() => { loadCameras.mockResolvedValue([]) })

		test("maps per-camera size and count metrics", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "cam1" }])
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [{ camera: "1", count: "7", size: "500" }] }))
			const res = await supertest(app)
				.post("/file/pathMetrics")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ size: { cam1: 500 }, count: { cam1: 7 } })
		})

		test("returns 500 when a metric query fails instead of hanging", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "cam1" }])
			bulkQuery.mockRejectedValueOnce(new Error("db error"))
			const res = await supertest(app)
				.post("/file/pathMetrics")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})

		test("returns 500 when the camera confs are unreadable instead of reporting empty metrics", async () => {
			loadCameras.mockRejectedValueOnce(new Error("EACCES"))
			const res = await supertest(app)
				.post("/file/pathMetrics")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
			expect(bulkQuery).not.toHaveBeenCalled()
		})

		test("scans the whole table on the bulk pool, since only the scheduler calls this and no page load is waiting on it", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "cam1" }])
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			await supertest(app)
				.post("/file/pathMetrics")
				.set("Cookie", cookieWithBearerToken)
			expect(bulkQuery.mock.calls[0][0]).toMatch(/SUM\(size\).+FROM frame_files GROUP BY camera/)
			expect(query).not.toHaveBeenCalled()
		})
	})

	describe("/file/dailyStats", () => {
		const { loadCameras } = require("lib")
		afterEach(() => { loadCameras.mockResolvedValue([]) })

		test("maps rows to per-camera byte totals", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "cam1" }, { id: 2, name: "cam2" }])
			const ts = new Date("2026-06-11T10:00:00Z")
			query.mockImplementationOnce(() => Promise.resolve({ rows: [
				{ timestamp: ts, cam1: "100", cam2: "200" }
			] }))
			const res = await supertest(app)
				.get("/file/dailyStats")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(200)
			expect(res.body).toEqual([{ timestamp: ts.getTime(), cam1: 100, cam2: 200 }])
		})

		test("returns 500 on db error", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "cam1" }])
			query.mockRejectedValueOnce(new Error("db error"))
			const res = await supertest(app)
				.get("/file/dailyStats")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})

		test("escapes double quotes in camera names (SQL identifier injection)", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "ev\"il" }])
			const res = await supertest(app)
				.get("/file/dailyStats")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(200)
			expect(query).toHaveBeenCalledWith(expect.stringContaining("as \"ev\"\"il\""))
		})

		test("returns 500 when the camera confs are unreadable instead of an empty series", async () => {
			loadCameras.mockRejectedValueOnce(new Error("EACCES"))
			const res = await supertest(app)
				.get("/file/dailyStats")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
			expect(query).not.toHaveBeenCalled()
		})
	})

	describe("/file/pathDelete", () => {
		test("returns 401 with no cookie", (done) => {
			supertest(app)
				.post("/file/pathDelete")
				.send({})
				.expect(401, done)
		})

		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/file/pathDelete")
				.send({})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})

		test("reports deleted:false when the database delete matched no rows", async () => {
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			const res = await supertest(app)
				.post("/file/pathDelete")
				.send({ camera: 1 })
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ deleted: false })
		})

		test("wipes the camera's rows on the bulk pool, so a large camera outlives the request budget", async () => {
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			await supertest(app)
				.post("/file/pathDelete")
				.send({ camera: 1 })
				.set("Cookie", cookieWithBearerToken)
			expect(bulkQuery.mock.calls[0][0]).toMatch(/DELETE FROM frame_files WHERE camera=\$1 RETURNING/)
			expect(query).not.toHaveBeenCalled()
		})

		test("guards the delete record so wiping an already-empty camera logs no (0,0) row", async () => {
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			await supertest(app)
				.post("/file/pathDelete")
				.send({ camera: 1 })
				.set("Cookie", cookieWithBearerToken)
			expect(bulkQuery.mock.calls.some(([sql]) => sql.startsWith("INSERT INTO frame_deletes"))).toBe(false)
		})

		test("defers while an export lock is fresh, before deleting any database rows", async () => {
			const readdir = jest.spyOn(fs.promises, "readdir").mockResolvedValue(["zip_1_abc.txt"])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
			try {
				const res = await supertest(app)
					.post("/file/pathDelete")
					.send({ camera: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deferred: true })
				expect(bulkQuery).not.toHaveBeenCalled()
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
			}
		})

		test("unlinks in batches that recheck the lock, instead of one rimraf that never re-consults it", async () => {
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: "a.jpg" }] }))
			const dir = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", "1")
			const frames = Array.from({ length: 600 }, (_, i) => `20200101-000000-${String(i).padStart(3, "0")}.jpg`)
			let lockChecks = 0
			const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) => {
				if (p === dir) return Promise.resolve(frames)
				lockChecks++
				return Promise.resolve(lockChecks <= 2 ? [] : ["mp4_1_abc.txt"])
			})
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
			const rm = jest.spyOn(fs.promises, "rm").mockResolvedValue(undefined)
			const unlink = jest.spyOn(fs.promises, "unlink").mockResolvedValue(undefined)
			try {
				const res = await supertest(app)
					.post("/file/pathDelete")
					.send({ camera: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: false, deferred: true })
				expect(unlink).toHaveBeenCalledTimes(500)
				expect(rm).not.toHaveBeenCalled()
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
				rm.mockRestore()
				unlink.mockRestore()
			}
		})

		test("returns 500 when the directory cannot be removed, so a failure is not read as an empty camera", async () => {
			const readdir = jest.spyOn(fs.promises, "readdir").mockResolvedValue([])
			const rm = jest.spyOn(fs.promises, "rm").mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }))
			try {
				const res = await supertest(app)
					.post("/file/pathDelete")
					.send({ camera: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(500)
				expect(bulkQuery).not.toHaveBeenCalled()
			} finally {
				readdir.mockRestore()
				rm.mockRestore()
			}
		})

		test("does not defer for an export on a different camera", async () => {
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			const readdir = jest.spyOn(fs.promises, "readdir").mockResolvedValue(["zip_2_abc.txt"])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
			try {
				const res = await supertest(app)
					.post("/file/pathDelete")
					.send({ camera: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body.deferred).toBeUndefined()
				expect(bulkQuery).toHaveBeenCalled()
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
			}
		})
	})

	describe("/file/pathClean", () => {
		test("returns 401 with no cookie", (done) => {
			supertest(app)
				.post("/file/pathClean")
				.send({})
				.expect(401, done)
		})

		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/file/pathClean")
				.send({})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})

		describe("as admin", () => {
			let unlinkSpy
			const defaultBulk = (sql) => Promise.resolve(/COUNT/.test(sql) ? { rows: [{ count: "0" }] } : { rows: [] })
			const mockPrune = (rows) => bulkQuery.mockImplementation((sql, params) => {
				if (sql.startsWith("SELECT name FROM frame_files")) return Promise.resolve({ rows })
				if (sql.startsWith("DELETE FROM frame_files")) return Promise.resolve({ rows: params[1].map(() => ({ size: "100" })) })
				return defaultBulk(sql)
			})
			beforeEach(() => {
				unlinkSpy = jest.spyOn(fs.promises, "unlink").mockResolvedValue(undefined)
			})
			afterEach(() => {
				unlinkSpy.mockRestore()
				bulkQuery.mockImplementation(defaultBulk)
			})

			test("deletes the exact filenames returned from the database", async () => {
				mockPrune([{ name: "a.jpg", size: "100" }, { name: "b.jpg", size: "200" }])
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: true })
				const base = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", "1")
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(base, "a.jpg"))
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(base, "b.jpg"))
				expect(unlinkSpy).toHaveBeenCalledTimes(2)
			})

			test("prunes on the bulk pool, so a long backlog outlives the request budget", async () => {
				bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(bulkQuery).toHaveBeenCalledTimes(1)
				expect(query).not.toHaveBeenCalled()
			})

			test("builds the delete cutoff and recorded timestamp in UTC regardless of session timezone", async () => {
				mockPrune([{ name: "a.jpg", size: "100" }])
				await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				const [selectSql, selectValues] = bulkQuery.mock.calls[0]
				expect(selectSql).toMatch(/AND timestamp<=\(\$2::timestamp AT TIME ZONE 'UTC'\)/)
				expect(selectValues[1]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
				const [recordSql, recordValues] = bulkQuery.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO frame_deletes"))
				expect(recordSql).toMatch(/VALUES \(\(\$1::timestamp AT TIME ZONE 'UTC'\)/)
				expect(recordValues[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
			})

			test("skips null filenames without throwing", async () => {
				mockPrune([{ name: "a.jpg", size: "100" }, { name: null, size: "200" }])
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: true })
				const base = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", "1")
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(base, "a.jpg"))
				expect(unlinkSpy).toHaveBeenCalledTimes(1)
			})

			test("sweeps untracked .jpg orphans whose captured timestamp is older than the cutoff", async () => {
				mockPrune([{ name: "tracked.jpg", size: "100" }])
				const dir = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", "1")
				const readdirSpy = jest.spyOn(fs.promises, "readdir")
					.mockResolvedValue(["tracked.jpg", "20200101-000000-00.jpg", "20991231-235959-00.jpg", "garbage.jpg", "note.txt"])
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: true })
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(dir, "tracked.jpg"))
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(dir, "20200101-000000-00.jpg"))
				expect(unlinkSpy).not.toHaveBeenCalledWith(path.join(dir, "20991231-235959-00.jpg"))
				expect(unlinkSpy).not.toHaveBeenCalledWith(path.join(dir, "garbage.jpg"))
				expect(unlinkSpy).not.toHaveBeenCalledWith(path.join(dir, "note.txt"))
				readdirSpy.mockRestore()
			})

			test("sweeps orphans past the cutoff even when the database delete matched no rows", async () => {
				bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				const dir = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", "1")
				const readdirSpy = jest.spyOn(fs.promises, "readdir")
					.mockResolvedValue(["20200101-000000-00.jpg", "20991231-235959-00.jpg"])
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: false })
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(dir, "20200101-000000-00.jpg"))
				expect(unlinkSpy).not.toHaveBeenCalledWith(path.join(dir, "20991231-235959-00.jpg"))
				readdirSpy.mockRestore()
			})

			test("reports deleted:false when an unlink fails but the DB rows were removed", async () => {
				bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: "a.jpg", size: "100" }, { name: "b.jpg", size: "200" }] }))
				unlinkSpy.mockRejectedValueOnce(new Error("EACCES"))
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: false })
			})

			test("returns 500 when the deletion query fails", async () => {
				bulkQuery.mockRejectedValueOnce(new Error("db error"))
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(500)
				expect(res.body).toEqual({ error: true })
				expect(unlinkSpy).not.toHaveBeenCalled()
			})

			test("rejects days=0 (wipe-everything) before any deletion", async () => {
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 0 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ error: "number of days not provided" })
				expect(bulkQuery).not.toHaveBeenCalled()
				expect(unlinkSpy).not.toHaveBeenCalled()
			})

			test("defers while an export lock is fresh, before deleting any database rows", async () => {
				const readdir = jest.spyOn(fs.promises, "readdir").mockResolvedValue(["zip_1_abc.txt"])
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				try {
					const res = await supertest(app)
						.post("/file/pathClean")
						.send({ camera: 1, days: 1 })
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ deferred: true })
					expect(bulkQuery).not.toHaveBeenCalled()
					expect(unlinkSpy).not.toHaveBeenCalled()
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("cleans camera 1 while camera 2 is exporting, since their frame sets are disjoint", async () => {
				mockPrune([{ name: "a.jpg", size: "100" }])
				const dir = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", "1")
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) =>
					Promise.resolve(p === dir ? [] : ["mp4_2_abc.txt"]))
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				try {
					const res = await supertest(app)
						.post("/file/pathClean")
						.send({ camera: 1, days: 1 })
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ deleted: true })
					expect(unlinkSpy).toHaveBeenCalledWith(path.join(dir, "a.jpg"))
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("defers before the first unlink batch when an export starts during the database delete", async () => {
				bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: "a.jpg", size: "100" }] }))
				let exportChecks = 0
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation(() =>
					Promise.resolve(++exportChecks <= 1 ? [] : ["mp4_1_abc.txt"]))
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				try {
					const res = await supertest(app)
						.post("/file/pathClean")
						.send({ camera: 1, days: 1 })
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ deleted: false, deferred: true })
					expect(unlinkSpy).not.toHaveBeenCalled()
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("skips the orphan sweep when an export starts after the tracked unlinks", async () => {
				mockPrune([{ name: "a.jpg", size: "100" }])
				const dir = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", "1")
				let exportChecks = 0
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation(() =>
					Promise.resolve(++exportChecks <= 2 ? [] : ["mp4_1_abc.txt", "20200101-000000-00.jpg"]))
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				try {
					const res = await supertest(app)
						.post("/file/pathClean")
						.send({ camera: 1, days: 1 })
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ deleted: true, deferred: true })
					expect(unlinkSpy).toHaveBeenCalledWith(path.join(dir, "a.jpg"))
					expect(unlinkSpy).not.toHaveBeenCalledWith(path.join(dir, "20200101-000000-00.jpg"))
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("rechecks the export lock between orphan-sweep batches instead of once for the whole sweep", async () => {
				bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				const dir = path.join(process.env.storage_FOLDERPATH, "./shared/captures/", "1")
				const stale = Array.from({ length: 501 }, (_, i) => `20200101-000000-${String(i).padStart(3, "0")}.jpg`)
				let lockChecks = 0
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) => {
					if (p === dir) return Promise.resolve(stale)
					lockChecks++
					return Promise.resolve(lockChecks <= 2 ? [] : ["mp4_1_abc.txt"])
				})
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				try {
					const res = await supertest(app)
						.post("/file/pathClean")
						.send({ camera: 1, days: 1 })
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ deleted: false, deferred: true })
					expect(unlinkSpy).toHaveBeenCalledTimes(500)
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("still settles the deferral streak when the stale-file delete query fails", async () => {
				fs.writeFileSync(DEFERRAL_STATE_PATH, JSON.stringify({ "/file/pathClean:1": 3 }))
				bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
					.mockImplementationOnce(() => Promise.reject(new Error("deadlock detected")))
				const readdirSpy = jest.spyOn(fs.promises, "readdir").mockResolvedValue(["20200101-000000-00.jpg"])
				try {
					const res = await supertest(app)
						.post("/file/pathClean")
						.send({ camera: 1, days: 1 })
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(500)
					expect(res.body).toEqual({ error: true })
					expect(JSON.parse(fs.readFileSync(DEFERRAL_STATE_PATH, "utf8"))).toEqual({})
				} finally {
					readdirSpy.mockRestore()
				}
			})
		})
	})

	describe("/file/pathAutoClean", () => {
		test("returns 401 with no cookie", (done) => {
			supertest(app)
				.post("/file/pathAutoClean")
				.send({})
				.expect(401, done)
		})

		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/file/pathAutoClean")
				.send({})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})

		describe("as admin", () => {
			let unlinkSpy
			beforeEach(() => {
				unlinkSpy = jest.spyOn(fs.promises, "unlink").mockResolvedValue(undefined)
			})
			afterEach(() => {
				unlinkSpy.mockRestore()
				delete process.env.storage_MAX_GB
			})

			test("skips when storage_MAX_GB is unset", async () => {
				delete process.env.storage_MAX_GB
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ skipped: true })
				expect(bulkQuery).not.toHaveBeenCalled()
			})

			test("reports cleaned:false when usage is under target", async () => {
				process.env.storage_MAX_GB = "10"
				bulkQuery.mockResolvedValueOnce({ rows: [{ total: "1000000" }] })
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: false })
				expect(bulkQuery).toHaveBeenCalledTimes(1)
			})

			test("deletes oldest frames until under target when over limit", async () => {
				process.env.storage_MAX_GB = "1"
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "a.jpg", size: "600000000" },
						{ id: 2, camera: "1", name: "b.jpg", size: "600000000" },
						{ id: 3, camera: "1", name: "c.jpg", size: "600000000" }
					] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: true, deleted: 2 })
				expect(unlinkSpy).toHaveBeenCalledTimes(2)
				expect(bulkQuery).toHaveBeenCalledTimes(3)
				expect(bulkQuery.mock.calls[2][1][0]).toEqual([1, 2])
				expect(query).not.toHaveBeenCalled()
			})

			test("confines a traversal-laden frame name to the camera directory", async () => {
				process.env.storage_MAX_GB = "1"
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "../../../../etc/passwd.jpg", size: "600000000" },
						{ id: 2, camera: "1", name: "b.jpg", size: "600000000" }
					] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				const base = path.join(process.env.storage_FOLDERPATH, "shared/captures", "1")
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(base, "passwd.jpg"))
				unlinkSpy.mock.calls.forEach(([p]) => {
					expect(path.resolve(String(p)).startsWith(path.resolve(base) + path.sep)).toBe(true)
				})
			})

			test("skips when non-frame artifacts dominate and deleting all frames can't reach target", async () => {
				process.env.storage_MAX_GB = "1"
				bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "500000000" }] }))
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) =>
					Promise.resolve(String(p).endsWith("captures")
						? [{ name: "big.mp4", isFile: () => true }]
						: []))
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 2000000000 })
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: false })
					expect(bulkQuery).toHaveBeenCalledTimes(1)
					expect(unlinkSpy).not.toHaveBeenCalled()
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("keeps freeing space, deleting rows only for the frames it actually unlinked", async () => {
				process.env.storage_MAX_GB = "1"
				const eacces = Object.assign(new Error("read-only"), { code: "EACCES" })
				unlinkSpy.mockImplementation((p) => String(p).includes("stuck") ? Promise.reject(eacces) : Promise.resolve(undefined))
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "stuck-a.jpg", size: "600000000" },
						{ id: 2, camera: "1", name: "c.jpg", size: "600000000" }
					] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 3, camera: "2", name: "d.jpg", size: "600000000" }
					] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: true, deleted: 2 })

				const deletes = bulkQuery.mock.calls.filter(([sql]) => sql.startsWith("DELETE")).map(([, params]) => params)
				expect(deletes).toEqual([[[2]], [[3]]])
				expect(bulkQuery.mock.calls[3][1][0]).toEqual([1])
			})

			test("alerts when every frame is stuck", async () => {
				process.env.storage_MAX_GB = "1"
				const { webhookAlert } = require("lib")
				const eacces = Object.assign(new Error("read-only"), { code: "EACCES" })
				unlinkSpy.mockRejectedValue(eacces)
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "a.jpg", size: "600000000" },
						{ id: 2, camera: "1", name: "b.jpg", size: "600000000" }
					] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: false })
				expect(bulkQuery).toHaveBeenCalledTimes(3)
				expect(webhookAlert).toHaveBeenCalledWith(expect.stringContaining("could not unlink 2 frame file(s)"), "admin")
			})

			test("gives up paging once nothing can be unlinked instead of walking the whole table", async () => {
				process.env.storage_MAX_GB = "1"
				const eacces = Object.assign(new Error("read-only"), { code: "EACCES" })
				unlinkSpy.mockRejectedValue(eacces)
				let id = 0
				bulkQuery.mockImplementation((sql) => {
					if (sql.startsWith("SELECT COALESCE")) return Promise.resolve({ rows: [{ total: "1800000000" }] })
					if (sql.startsWith("SELECT id")) {
						if (id >= 20) return Promise.resolve({ rows: [] })
						id++
						return Promise.resolve({ rows: [{ id, camera: "1", name: `f${id}.jpg`, size: "100000000" }] })
					}
					return Promise.resolve({ rows: [] })
				})
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: false })
				expect(bulkQuery.mock.calls.filter(([sql]) => sql.startsWith("SELECT id"))).toHaveLength(3)
			})

			test("skips a fully stuck batch and frees the frames behind it", async () => {
				process.env.storage_MAX_GB = "1"
				const eacces = Object.assign(new Error("read-only"), { code: "EACCES" })
				unlinkSpy.mockImplementation((p) => String(p).includes("stuck") ? Promise.reject(eacces) : Promise.resolve(undefined))
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "stuck-a.jpg", size: "600000000" },
						{ id: 2, camera: "1", name: "stuck-b.jpg", size: "600000000" }
					] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 3, camera: "2", name: "c.jpg", size: "600000000" },
						{ id: 4, camera: "2", name: "d.jpg", size: "600000000" }
					] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: true, deleted: 2 })

				const deletes = bulkQuery.mock.calls.filter(([sql]) => sql.startsWith("DELETE")).map(([, params]) => params)
				expect(deletes).toEqual([[[3, 4]]])
				expect(bulkQuery.mock.calls[2][1][0]).toEqual([1, 2])
			})

			test("returns 500 on db error", async () => {
				process.env.storage_MAX_GB = "1"
				bulkQuery.mockRejectedValueOnce(new Error("db error"))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(500)
			})

			test("excludes the exporting camera's frames from the page rather than deferring the whole run", async () => {
				process.env.storage_MAX_GB = "1"
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) =>
					Promise.resolve(opts && opts.withFileTypes ? [] : ["mp4_1_abc.txt"]))
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ camera: "1" }] }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: false, deferred: true })
					const [, params] = bulkQuery.mock.calls.find(([sql]) => sql.startsWith("SELECT id"))
					expect(params[1]).toEqual([1])
					expect(unlinkSpy).not.toHaveBeenCalled()
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("frees camera 1's frames while camera 2 is exporting, since their frame sets are disjoint", async () => {
				process.env.storage_MAX_GB = "1"
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) =>
					Promise.resolve(opts && opts.withFileTypes ? [] : ["mp4_2_abc.txt"]))
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "a.jpg", size: "900000000" }
					] }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: true, deleted: 1 })
					const [, params] = bulkQuery.mock.calls.find(([sql]) => sql.startsWith("SELECT id"))
					expect(params[1]).toEqual([2])
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("does not defer for a stale export lock, so a crashed export cannot block cap enforcement", async () => {
				process.env.storage_MAX_GB = "10"
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) =>
					Promise.resolve(opts && opts.withFileTypes ? [] : ["mp4_1_abc.txt"]))
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() - 60 * 60 * 1000 })
				bulkQuery.mockResolvedValueOnce({ rows: [{ total: "1000000" }] })
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: false })
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("re-pages without the exporting camera when an export starts mid-run", async () => {
				process.env.storage_MAX_GB = "1"
				let exportChecks = 0
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) => {
					if (opts && opts.withFileTypes) return Promise.resolve([])
					exportChecks++
					return Promise.resolve(exportChecks <= 1 ? [] : ["mp4_1_abc.txt"])
				})
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "a.jpg", size: "400000000" }
					] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ camera: "1" }] }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: true, deleted: 1, deferred: true })
					const pages = bulkQuery.mock.calls.filter(([sql]) => sql.startsWith("SELECT id")).map(([, params]) => params[1])
					expect(pages).toEqual([[], [1]])
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("skips a camera that locks part-way through a page, instead of deleting the rest of its frames", async () => {
				process.env.storage_MAX_GB = "1"
				let exportChecks = 0
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) => {
					if (opts && opts.withFileTypes) return Promise.resolve([])
					exportChecks++
					return Promise.resolve(exportChecks <= 1 ? [] : ["mp4_1_abc.txt"])
				})
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: Array.from({ length: 600 }, (_, i) => ({ id: i + 1, camera: "1", name: `${i}.jpg`, size: "1000" })) }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: true, deleted: 500, deferred: true })
					expect(unlinkSpy).toHaveBeenCalledTimes(500)
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("omits deferred when the pass ends for any reason other than an export", async () => {
				process.env.storage_MAX_GB = "1"
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) =>
					Promise.resolve(opts && opts.withFileTypes ? [] : []))
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: false })
				} finally {
					readdir.mockRestore()
				}
			})

			test("does not defer when the exporting camera owns none of the outstanding frames", async () => {
				process.env.storage_MAX_GB = "1"
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) =>
					Promise.resolve(opts && opts.withFileTypes ? [] : ["mp4_2_abc.txt"]))
				const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
				bulkQuery
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: false })
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})
		})
	})

	describe("consecutive deferral cap", () => {
		const { webhookAlert } = require("lib")

		const cleanWithExportOn = (lockCamera, camera) => {
			const readdir = jest.spyOn(fs.promises, "readdir").mockResolvedValue([`mp4_${lockCamera}_abc.txt`])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
			return supertest(app)
				.post("/file/pathClean")
				.send({ camera, days: 1 })
				.set("Cookie", cookieWithBearerToken)
				.then((res) => {
					readdir.mockRestore()
					stat.mockRestore()
					return res
				})
		}

		test("alerts once a scheduled prune has deferred behind exports too many runs in a row", async () => {
			for (let run = 1; run < MAX_CONSECUTIVE_DEFERRALS; run++) {
				const res = await cleanWithExportOn(1, 1)
				expect(res.body).toEqual({ deferred: true })
			}
			expect(webhookAlert).not.toHaveBeenCalledWith(expect.stringContaining("deferred"), "admin")

			const res = await cleanWithExportOn(1, 1)
			expect(res.body).toEqual({ deferred: true })
			expect(webhookAlert).toHaveBeenCalledWith(
				expect.stringContaining(`/file/pathClean:1 has deferred ${MAX_CONSECUTIVE_DEFERRALS} runs in a row`),
				"admin"
			)
		})

		test("a run that completes resets the streak, so intermittent exports never alert", async () => {
			for (let run = 1; run < MAX_CONSECUTIVE_DEFERRALS; run++) {
				await cleanWithExportOn(1, 1)
			}

			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			await cleanWithExportOn(2, 1)

			const res = await cleanWithExportOn(1, 1)
			expect(res.body).toEqual({ deferred: true })
			expect(webhookAlert).not.toHaveBeenCalledWith(expect.stringContaining("runs in a row"), "admin")
		})

		test("counts each camera separately, so one busy camera cannot alert for another", async () => {
			for (let run = 1; run < MAX_CONSECUTIVE_DEFERRALS; run++) {
				await cleanWithExportOn(1, 1)
			}
			await cleanWithExportOn(2, 2)

			expect(webhookAlert).not.toHaveBeenCalledWith(expect.stringContaining("runs in a row"), "admin")
			expect(JSON.parse(fs.readFileSync(DEFERRAL_STATE_PATH, "utf8"))).toEqual({
				"/file/pathClean:1": MAX_CONSECUTIVE_DEFERRALS - 1,
				"/file/pathClean:2": 1
			})
		})

		test("retries against a live cross-process deferral lock until the other holder releases it", async () => {
			const lockPath = `${DEFERRAL_STATE_PATH}.lock`
			fs.writeFileSync(lockPath, "")
			const release = setTimeout(() => { try { fs.unlinkSync(lockPath) } catch { /* already gone */ } }, 60)

			try {
				const res = await cleanWithExportOn(1, 1)
				expect(res.body).toEqual({ deferred: true })
				expect(JSON.parse(fs.readFileSync(DEFERRAL_STATE_PATH, "utf8"))).toEqual({ "/file/pathClean:1": 1 })
			} finally {
				clearTimeout(release)
			}
		})

		test("reclaims a stale cross-process deferral lock instead of waiting on a dead holder", async () => {
			const lockPath = `${DEFERRAL_STATE_PATH}.lock`
			fs.writeFileSync(lockPath, "")
			const stale = new Date(Date.now() - 60000)
			fs.utimesSync(lockPath, stale, stale)

			const res = await cleanWithExportOn(1, 1)

			expect(res.body).toEqual({ deferred: true })
			expect(JSON.parse(fs.readFileSync(DEFERRAL_STATE_PATH, "utf8"))).toEqual({ "/file/pathClean:1": 1 })
			expect(fs.existsSync(lockPath)).toBe(false)
		})

		const autoCleanWithExportOn = () => {
			const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) =>
				Promise.resolve(opts && opts.withFileTypes ? [] : ["mp4_1_abc.txt"]))
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ mtimeMs: Date.now() })
			bulkQuery.mockImplementation((sql) => {
				if (sql.startsWith("SELECT COALESCE")) return Promise.resolve({ rows: [{ total: "1800000000" }] })
				if (sql.startsWith("SELECT id")) return Promise.resolve({ rows: [] })
				if (sql.startsWith("SELECT 1")) return Promise.resolve({ rows: [{ camera: "1" }] })
				return Promise.resolve({ rows: [] })
			})
			return supertest(app)
				.post("/file/pathAutoClean")
				.set("Cookie", cookieWithBearerToken)
				.then((res) => {
					readdir.mockRestore()
					stat.mockRestore()
					return res
				})
		}

		test("alerts with the cap-enforcement note when pathAutoClean itself defers too many runs in a row", async () => {
			process.env.storage_MAX_GB = "1"
			try {
				for (let run = 1; run < MAX_CONSECUTIVE_DEFERRALS; run++) {
					const res = await autoCleanWithExportOn()
					expect(res.body).toEqual({ cleaned: false, deferred: true })
				}
				expect(webhookAlert).not.toHaveBeenCalledWith(expect.stringContaining("Cap enforcement is stalled"), "admin")

				const res = await autoCleanWithExportOn()
				expect(res.body).toEqual({ cleaned: false, deferred: true })
				expect(webhookAlert).toHaveBeenCalledWith(
					expect.stringContaining(`/file/pathAutoClean has deferred ${MAX_CONSECUTIVE_DEFERRALS} runs in a row`),
					"admin"
				)
				expect(webhookAlert).toHaveBeenCalledWith(
					expect.stringContaining("Cap enforcement is stalled and disk may grow past storage_MAX_GB."),
					"admin"
				)
			} finally {
				delete process.env.storage_MAX_GB
			}
		})
	})

	describe("orphan frame sweep", () => {
		const captures = path.join(process.env.storage_FOLDERPATH, "shared/captures")
		const stale = "20200101-000000-00.jpg"

		const mockCameraDir = (files) => jest.spyOn(fs.promises, "readdir").mockImplementation((p, opts) =>
			Promise.resolve(opts && opts.withFileTypes
				? [{ name: "1", isDirectory: () => true }, { name: "output_1_a_b_c.mp4", isDirectory: () => false }]
				: p === path.join(captures, "1") ? files : []))

		const insertCall = () => bulkQuery.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO frame_files"))

		test("backfills an untracked frame with its size and the capture time in its filename", async () => {
			const readdir = mockCameraDir([stale])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 4096, mtimeMs: Date.now() - 60 * 60 * 1000 })
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			try {
				expect(await sweepOrphanFrames()).toBe(1)
				const [, params] = insertCall()
				expect(params[0]).toEqual([new Date("2020-01-01T00:00:00Z").toISOString()])
				expect(params[1]).toEqual(["1"])
				expect(params[2]).toEqual([stale])
				expect(params[3]).toEqual([4096])
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
			}
		})

		test("leaves a frame that already has a row alone", async () => {
			const readdir = mockCameraDir([stale])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 4096, mtimeMs: Date.now() - 60 * 60 * 1000 })
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: stale }] }))
			try {
				expect(await sweepOrphanFrames()).toBe(0)
				expect(insertCall()).toBeUndefined()
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
			}
		})

		test("ignores a frame inside the grace period, whose row motion has not inserted yet", async () => {
			const fresh = moment.utc().subtract(FRAME_SWEEP_GRACE_MS / 2, "ms").format("YYYYMMDD-HHmmss") + "-00.jpg"
			const readdir = mockCameraDir([fresh])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 4096, mtimeMs: Date.now() })
			try {
				expect(await sweepOrphanFrames()).toBe(0)
				expect(bulkQuery).not.toHaveBeenCalled()
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
			}
		})

		test("falls back to the file's mtime when the name carries no parseable capture time", async () => {
			const mtimeMs = Date.parse("2021-06-01T12:00:00Z")
			const readdir = mockCameraDir(["not-a-timestamp.jpg"])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 512, mtimeMs })
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			try {
				expect(await sweepOrphanFrames()).toBe(1)
				const [, params] = insertCall()
				expect(params[0]).toEqual([new Date(mtimeMs).toISOString()])
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
			}
		})

		test("looks frames up by camera and name, so the diff can use the index instead of scanning", async () => {
			const readdir = mockCameraDir([stale])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 4096, mtimeMs: Date.now() - 60 * 60 * 1000 })
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			try {
				await sweepOrphanFrames()
				const [sql, params] = bulkQuery.mock.calls[0]
				expect(sql).toMatch(/SELECT name FROM frame_files WHERE camera = \$1 AND name = ANY\(\$2::varchar\[\]\)/)
				expect(params).toEqual(["1", [stale]])
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
			}
		})

		test("skips a sweep that starts while a previous sweep is still in progress", async () => {
			const readdir = mockCameraDir([stale])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 4096, mtimeMs: Date.now() - 60 * 60 * 1000 })
			bulkQuery.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			const log = jest.spyOn(console, "log").mockImplementation(() => {})
			try {
				const first = sweepOrphanFrames()
				const second = sweepOrphanFrames()
				expect(await second).toBe(0)
				expect(log).toHaveBeenCalledWith(expect.stringContaining("STORAGE FRAME SWEEP SKIPPED"))
				expect(await first).toBe(1)
			} finally {
				log.mockRestore()
				readdir.mockRestore()
				stat.mockRestore()
			}
		})

		test("leaves a frame alone while its camera's clean is mid-run, because the row outlives the file", async () => {
			const readdir = mockCameraDir([stale])
			const stat = jest.spyOn(fs.promises, "stat").mockResolvedValue({ size: 4096, mtimeMs: Date.now() - 60 * 60 * 1000 })
			let arrived, release
			const atSelect = new Promise((r) => { arrived = r })
			const gate = new Promise((r) => { release = r })
			bulkQuery.mockImplementation((sql) => {
				if (sql.startsWith("SELECT name FROM frame_files WHERE camera=$1 AND timestamp")) {
					arrived()
					return gate.then(() => ({ rows: [{ name: stale }] }))
				}
				if (sql.includes("name = ANY($2::varchar[])")) return Promise.resolve({ rows: [{ name: stale, size: "4096" }] })
				return Promise.resolve({ rows: [] })
			})
			try {
				const clean = supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
					.then((r) => r)
				await atSelect
				expect(await sweepOrphanFrames()).toBe(0)
				expect(insertCall()).toBeUndefined()
				release()
				await clean
			} finally {
				readdir.mockRestore()
				stat.mockRestore()
				bulkQuery.mockImplementation((sql) => Promise.resolve(/COUNT/.test(sql) ? { rows: [{ count: "0" }] } : { rows: [] }))
			}
		})
	})
})
