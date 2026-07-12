process.env.storage_FOLDERPATH = "/tmp/storage-file-test"

const supertest = require("supertest")

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")
jest.mock("axios")
jest.mock("pg", () => {
	const query = jest.fn((sql) =>
		Promise.resolve(/COUNT/.test(sql) ? { rows: [{ count: "0" }] } : { rows: [] })
	)
	return { Pool: jest.fn(() => ({ query, on: jest.fn() })), __query: query }
})

const app = require("../backend/storage.js")
const fs = require("fs")
const path = require("path")
const { __query: query } = require("pg")

describe("File Routes", () => {
	let cookieWithBearerToken = "validCookie"

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
			query.mockImplementationOnce(() => Promise.resolve({ rows: [{ camera: "1", count: "7", size: "500" }] }))
			const res = await supertest(app)
				.post("/file/pathMetrics")
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ size: { cam1: 500 }, count: { cam1: 7 } })
		})

		test("returns 500 when a metric query fails instead of hanging", async () => {
			loadCameras.mockResolvedValue([{ id: 1, name: "cam1" }])
			query.mockRejectedValueOnce(new Error("db error"))
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
			query.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
			const res = await supertest(app)
				.post("/file/pathDelete")
				.send({ camera: 1 })
				.set("Cookie", cookieWithBearerToken)
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ deleted: false })
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
			beforeEach(() => {
				unlinkSpy = jest.spyOn(fs.promises, "unlink").mockResolvedValue(undefined)
			})
			afterEach(() => { unlinkSpy.mockRestore() })

			test("deletes the exact filenames returned from the database", async () => {
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: "a.jpg", size: "100" }, { name: "b.jpg", size: "200" }] }))
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: true })
				const base = path.join("/tmp/storage-file-test", "./shared/captures/", "1")
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(base, "a.jpg"))
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(base, "b.jpg"))
				expect(unlinkSpy).toHaveBeenCalledTimes(2)
			})

			test("builds the delete cutoff and recorded timestamp in UTC regardless of session timezone", async () => {
				query.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				const [sql, values] = query.mock.calls[0]
				expect(sql).toMatch(/AND timestamp<=\(\$2::timestamp AT TIME ZONE 'UTC'\)/)
				expect(sql).toMatch(/INSERT INTO frame_deletes\(timestamp, camera, size, count\) SELECT \(\$3::timestamp AT TIME ZONE 'UTC'\)/)
				expect(values[1]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
				expect(values[2]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
			})

			test("skips null filenames without throwing", async () => {
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: "a.jpg", size: "100" }, { name: null, size: "200" }] }))
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: true })
				const base = path.join("/tmp/storage-file-test", "./shared/captures/", "1")
				expect(unlinkSpy).toHaveBeenCalledWith(path.join(base, "a.jpg"))
				expect(unlinkSpy).toHaveBeenCalledTimes(1)
			})

			test("sweeps untracked .jpg orphans whose captured timestamp is older than the cutoff", async () => {
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: "tracked.jpg", size: "100" }] }))
				const dir = path.join("/tmp/storage-file-test", "./shared/captures/", "1")
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
				query.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				const dir = path.join("/tmp/storage-file-test", "./shared/captures/", "1")
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
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ name: "a.jpg", size: "100" }, { name: "b.jpg", size: "200" }] }))
				unlinkSpy.mockRejectedValueOnce(new Error("EACCES"))
				const res = await supertest(app)
					.post("/file/pathClean")
					.send({ camera: 1, days: 1 })
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ deleted: false })
			})

			test("returns 500 when the deletion query fails", async () => {
				query.mockRejectedValueOnce(new Error("db error"))
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
				expect(query).not.toHaveBeenCalled()
				expect(unlinkSpy).not.toHaveBeenCalled()
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
				expect(query).not.toHaveBeenCalled()
			})

			test("reports cleaned:false when usage is under target", async () => {
				process.env.storage_MAX_GB = "10"
				query.mockResolvedValueOnce({ rows: [{ total: "1000000" }] })
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: false })
				expect(query).toHaveBeenCalledTimes(1)
			})

			test("deletes oldest frames until under target when over limit", async () => {
				process.env.storage_MAX_GB = "1"
				query
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
				expect(query).toHaveBeenCalledTimes(3)
				expect(query.mock.calls[2][1]).toEqual([[1, 2]])
			})

			test("prunes regenerable exports instead of frames when non-frame artifacts dominate", async () => {
				process.env.storage_MAX_GB = "1"
				// DB says total frame size is only 500MB; captures hold 2GB of exports
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "500000000" }] }))
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) =>
					Promise.resolve(String(p).endsWith("captures")
						? [
							{ name: "output_1_start_end_old.mp4", isFile: () => true },
							{ name: "output_1_start_end_new.zip", isFile: () => true }
						]
						: []))
				const stat = jest.spyOn(fs.promises, "stat").mockImplementation((p) =>
					Promise.resolve({ size: 1000000000, mtimeMs: String(p).includes("old") ? 1 : 2 }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: true, deleted: 0, exports: 2 })
					expect(unlinkSpy).toHaveBeenCalledTimes(2)
					expect(unlinkSpy.mock.calls.map(([p]) => path.basename(p))).toEqual([
						"output_1_start_end_old.mp4",
						"output_1_start_end_new.zip"
					])
					expect(query).toHaveBeenCalledTimes(1)
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("skips an export whose stat fails instead of deleting it for free as the oldest, zero-byte candidate", async () => {
				process.env.storage_MAX_GB = "1"
				// 500MB frames + a 1.5GB export = 2GB used, target 900MB, deficit 1.1GB
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "500000000" }] }))
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) =>
					Promise.resolve(String(p).endsWith("captures")
						? [
							{ name: "output_1_start_end_ghost.mp4", isFile: () => true },
							{ name: "output_1_start_end_real.mp4", isFile: () => true }
						]
						: []))
				const stat = jest.spyOn(fs.promises, "stat").mockImplementation((p) =>
					String(p).includes("ghost")
						? Promise.reject(new Error("ENOENT"))
						: Promise.resolve({ size: 1500000000, mtimeMs: 2 }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: true, deleted: 0, exports: 1 })
					expect(unlinkSpy.mock.calls.map(([p]) => path.basename(p))).toEqual([
						"output_1_start_end_real.mp4"
					])
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("frees the deficit from oldest exports and leaves frames intact", async () => {
				process.env.storage_MAX_GB = "1"
				// 500MB frames + 1.5GB exports = 2GB used, target 900MB, deficit 1.1GB
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "500000000" }] }))
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) =>
					Promise.resolve(String(p).endsWith("captures")
						? [
							{ name: "output_1_start_end_new.mp4", isFile: () => true },
							{ name: "output_1_start_end_old.mp4", isFile: () => true },
							{ name: "output_1_start_end_mid.mp4", isFile: () => true }
						]
						: []))
				const age = { old: 1, mid: 2, new: 3 }
				const stat = jest.spyOn(fs.promises, "stat").mockImplementation((p) => {
					const key = Object.keys(age).find((k) => String(p).includes(`_${k}.`))
					return Promise.resolve({ size: 500000000, mtimeMs: age[key] })
				})
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: true, deleted: 0, exports: 3 })
					expect(unlinkSpy.mock.calls.map(([p]) => path.basename(p))).toEqual([
						"output_1_start_end_old.mp4",
						"output_1_start_end_mid.mp4",
						"output_1_start_end_new.mp4"
					])
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("skips exports that are still being generated and leaves frames intact", async () => {
				process.env.storage_MAX_GB = "1"
				const { webhookAlert } = require("lib")
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "500000000" }] }))
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) =>
					Promise.resolve(String(p).endsWith("captures")
						? [
							{ name: "output_1_start_end_busy.mp4", isFile: () => true },
							{ name: "mp4_busy.txt", isFile: () => true }
						]
						: []))
				const stat = jest.spyOn(fs.promises, "stat").mockImplementation((p) =>
					Promise.resolve({ size: String(p).endsWith(".txt") ? 0 : 2000000000, mtimeMs: 1 }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: false })
					expect(unlinkSpy).not.toHaveBeenCalled()
					expect(query).toHaveBeenCalledTimes(1)
					expect(webhookAlert).toHaveBeenCalledWith(
						expect.stringContaining("non-frame artifacts"), "admin"
					)
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("still honours a lock file whose stat fails instead of deleting the export it is guarding mid-write", async () => {
				process.env.storage_MAX_GB = "1"
				const { webhookAlert } = require("lib")
				query.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "500000000" }] }))
				const readdir = jest.spyOn(fs.promises, "readdir").mockImplementation((p) =>
					Promise.resolve(String(p).endsWith("captures")
						? [
							{ name: "output_1_start_end_busy.zip", isFile: () => true },
							{ name: "zip_busy.txt", isFile: () => true }
						]
						: []))
				const stat = jest.spyOn(fs.promises, "stat").mockImplementation((p) =>
					String(p).endsWith(".txt")
						? Promise.reject(Object.assign(new Error("too many open files"), { code: "EMFILE" }))
						: Promise.resolve({ size: 2000000000, mtimeMs: 1 }))
				try {
					const res = await supertest(app)
						.post("/file/pathAutoClean")
						.set("Cookie", cookieWithBearerToken)
					expect(res.status).toBe(200)
					expect(res.body).toEqual({ cleaned: false })
					expect(unlinkSpy).not.toHaveBeenCalled()
					expect(webhookAlert).toHaveBeenCalledWith(
						expect.stringContaining("non-frame artifacts"), "admin"
					)
				} finally {
					readdir.mockRestore()
					stat.mockRestore()
				}
			})

			test("gives up after repeated fully-failed batches instead of looping forever", async () => {
				process.env.storage_MAX_GB = "1"
				const { webhookAlert } = require("lib")
				const eacces = Object.assign(new Error("read-only"), { code: "EACCES" })
				unlinkSpy.mockRejectedValue(eacces)
				const rows = (...ids) => ({ rows: ids.map(id => ({ id, camera: "1", name: `${id}.jpg`, size: "600000000" })) })
				query
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve(rows(1, 2, 3)))
					.mockImplementationOnce(() => Promise.resolve(rows(4, 5, 6)))
					.mockImplementationOnce(() => Promise.resolve(rows(7, 8, 9)))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: false })
				expect(query).toHaveBeenCalledTimes(4)
				expect(unlinkSpy).toHaveBeenCalledTimes(6)
				expect(webhookAlert).toHaveBeenCalledWith(expect.stringContaining("auto-clean gave up"), "admin")
			})

			test("alerts when every frame is stuck and the table runs out before the batch limit", async () => {
				process.env.storage_MAX_GB = "1"
				const { webhookAlert } = require("lib")
				const eacces = Object.assign(new Error("read-only"), { code: "EACCES" })
				unlinkSpy.mockRejectedValue(eacces)
				query
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "a.jpg", size: "600000000" },
						{ id: 2, camera: "1", name: "b.jpg", size: "600000000" },
						{ id: 3, camera: "1", name: "c.jpg", size: "600000000" }
					] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 3, camera: "1", name: "c.jpg", size: "600000000" }
					] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: false })
				expect(webhookAlert).toHaveBeenCalledWith(expect.stringContaining("auto-clean gave up"), "admin")
			})

			test("keeps freeing space when an entire batch is unremovable", async () => {
				process.env.storage_MAX_GB = "1"
				const eacces = Object.assign(new Error("read-only"), { code: "EACCES" })
				unlinkSpy.mockImplementation((p) => String(p).includes("stuck") ? Promise.reject(eacces) : Promise.resolve(undefined))
				query
					.mockImplementationOnce(() => Promise.resolve({ rows: [{ total: "1800000000" }] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 1, camera: "1", name: "stuck-a.jpg", size: "600000000" },
						{ id: 2, camera: "1", name: "stuck-b.jpg", size: "600000000" },
						{ id: 3, camera: "1", name: "c.jpg", size: "600000000" }
					] }))
					.mockImplementationOnce(() => Promise.resolve({ rows: [
						{ id: 3, camera: "1", name: "c.jpg", size: "600000000" },
						{ id: 4, camera: "2", name: "d.jpg", size: "600000000" }
					] }))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(200)
				expect(res.body).toEqual({ cleaned: true, deleted: 2 })
				expect(query.mock.calls[2][1]).toEqual([[1, 2]])
				expect(query.mock.calls[3][1]).toEqual([[3, 4]])
			})

			test("returns 500 on db error", async () => {
				process.env.storage_MAX_GB = "1"
				query.mockRejectedValueOnce(new Error("db error"))
				const res = await supertest(app)
					.post("/file/pathAutoClean")
					.set("Cookie", cookieWithBearerToken)
				expect(res.status).toBe(500)
			})
		})
	})
})
