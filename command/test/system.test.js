const fs = require("fs")
const os = require("os")
const path = require("path")

process.env.SECRETKEY = "test-secret"
process.env.command_COOKIE_SECURE = "false"
process.env.CHIMERA_UPDATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "chimera-update-"))

jest.mock("pg")
jest.mock("pm2")
jest.mock("axios")
jest.mock("memory")

let mockFiles = {}
let mockWriteFails = false

jest.mock("lib/utils/jsonFileHandling.js", () => ({
	readJSON: (file, onRead, onMissing = onRead) =>
		(file in mockFiles ? onRead(null, mockFiles[file]) : onMissing(new Error("ENOENT"), {})),
	writeJSON: (file, data, onWrite, onFail) => {
		if (mockWriteFails) return onFail(new Error("EACCES: permission denied"))
		mockFiles[file] = data
		onWrite()
	},
	isStringJSON: () => true
}))

const supertest = require("supertest")
const jwt = require("jsonwebtoken")
const app = require("../backend/command.js")
const { auth, updateBridge } = require("lib")
const { REQUEST, RUNNING, RESULT, VERSION } = updateBridge
const { version: RUNNING_VERSION } = require("../../package.json")

const { mockedPool } = require("pg")

const session = (role) => mockedPool.query.mockResolvedValueOnce({ rows: [{ role, revoked: false }], rowCount: 1 })

const as = (req, role = "admin", username = "susan") => {
	session(role)
	return req.set("Cookie", `bearertoken=Bearer%20${jwt.sign({ username, role, jti: `jti-${username}` }, "test-secret")}`)
}

describe("System Routes", () => {
	beforeEach(() => {
		mockFiles = {}
		mockWriteFails = false
		auth.invalidateAllSessions()
	})

	afterEach(() => jest.restoreAllMocks())

	describe("GET /system/update", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).get("/system/update")
			expect(res.status).toBe(401)
		})

		test("returns 403 for a non-admin, since an update takes the whole stack down", async () => {
			const res = await as(supertest(app).get("/system/update"), "user")
			expect(res.status).toBe(403)
		})

		test("reports idle with nothing on the bridge", async () => {
			const res = await as(supertest(app).get("/system/update"))
			expect(res.status).toBe(200)
			expect(res.body).toEqual({
				error: false,
				state: "idle",
				requestedAt: null,
				requestedBy: null,
				last: null,
				version: { current: RUNNING_VERSION, available: null, checkedAt: null, bump: null }
			})
		})

		// nothing publishes version.json until the watchdog runs, and the panel still has to name what is running
		test("falls back to the running version when the host has published nothing", async () => {
			const res = await as(supertest(app).get("/system/update"))
			expect(res.body.version).toMatchObject({ current: RUNNING_VERSION, bump: null })
		})

		test("classifies the published pair so the panel and the host gate agree", async () => {
			mockFiles[VERSION] = { current: "6.0.2", available: "7.0.0", at: "2026-08-13T00:00:00.000Z" }
			const res = await as(supertest(app).get("/system/update"))
			expect(res.body.version).toEqual({ current: "6.0.2", available: "7.0.0", checkedAt: "2026-08-13T00:00:00.000Z", bump: "major" })
		})

		test("reports a host already on the newest version as none rather than a bump", async () => {
			mockFiles[VERSION] = { current: "6.0.2", available: "6.0.2", at: "2026-08-13T00:00:00.000Z" }
			const res = await as(supertest(app).get("/system/update"))
			expect(res.body.version).toMatchObject({ bump: "none" })
		})

		test("reports a request the host watchdog has not picked up yet as pending", async () => {
			mockFiles[REQUEST] = { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "susan" }
			const res = await as(supertest(app).get("/system/update"))
			expect(res.body).toMatchObject({ state: "pending", requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "susan" })
		})

		// the panel keeps polling across the rebuild, and a stale result would read as finished
		test("a running marker outranks the last result, so an in-flight rebuild never reads as done", async () => {
			mockFiles[RUNNING] = { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "susan" }
			mockFiles[RESULT] = { success: true, message: "updated and rebuilt", at: "2026-08-12T00:00:00.000Z" }
			const res = await as(supertest(app).get("/system/update"))
			expect(res.body).toMatchObject({ state: "running", requestedBy: "susan", last: { success: true } })
		})

		test("hands back the last result once the bridge is clear again", async () => {
			mockFiles[RESULT] = { success: false, message: "`git pull` exited 1", at: "2026-08-12T00:00:00.000Z" }
			const res = await as(supertest(app).get("/system/update"))
			expect(res.body).toMatchObject({ state: "idle", last: { success: false, message: "`git pull` exited 1" } })
		})
	})

	describe("POST /system/update", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).post("/system/update")
			expect(res.status).toBe(401)
		})

		test("returns 403 for a non-admin", async () => {
			const res = await as(supertest(app).post("/system/update"), "user")
			expect(res.status).toBe(403)
			expect(mockFiles[REQUEST]).toBeUndefined()
		})

		test("writes a request naming the admin who asked for it", async () => {
			const res = await as(supertest(app).post("/system/update"))
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
			expect(mockFiles[REQUEST]).toMatchObject({ requestedBy: "susan", allowMajor: false })
			expect(mockFiles[REQUEST].requestedAt).toEqual(expect.any(String))
		})

		// the host holds a major bump unless the request carries the admin's confirmation
		test("carries the major confirmation through to the host", async () => {
			await as(supertest(app).post("/system/update")).send({ allowMajor: true })
			expect(mockFiles[REQUEST]).toMatchObject({ allowMajor: true })
		})

		test("treats anything but a true confirmation as none, so a stray body cannot open the gate", async () => {
			await as(supertest(app).post("/system/update")).send({ allowMajor: "yes" })
			expect(mockFiles[REQUEST]).toMatchObject({ allowMajor: false })
		})

		test("refuses a second request while one is still waiting", async () => {
			mockFiles[REQUEST] = { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "alex" }
			const res = await as(supertest(app).post("/system/update"))
			expect(res.status).toBe(409)
			expect(res.body).toEqual({ error: true, errors: "UPDATE_IN_PROGRESS" })
			expect(mockFiles[REQUEST].requestedBy).toBe("alex")
		})

		test("refuses a request while the host is mid-rebuild", async () => {
			mockFiles[RUNNING] = { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "alex" }
			const res = await as(supertest(app).post("/system/update"))
			expect(res.status).toBe(409)
			expect(mockFiles[REQUEST]).toBeUndefined()
		})

		// an unwritable bridge means the watchdog never sees the request, so the panel must not claim success
		test("reports a bridge it cannot write to", async () => {
			mockWriteFails = true
			jest.spyOn(console, "error").mockImplementation(() => {})
			const res = await as(supertest(app).post("/system/update"))
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})
	})

	describe("DELETE /system/update", () => {
		test("returns 401 with no token", async () => {
			const res = await supertest(app).delete("/system/update")
			expect(res.status).toBe(401)
		})

		test("returns 403 for a non-admin", async () => {
			const res = await as(supertest(app).delete("/system/update"), "user")
			expect(res.status).toBe(403)
		})

		test("cancels a pending request", async () => {
			mockFiles[REQUEST] = { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "susan" }
			const res = await as(supertest(app).delete("/system/update"))
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		// a stale panel can show a pending row the watchdog already finished — cancelling it must not claim a run is in progress
		test("is a no-op when nothing is pending", async () => {
			const res = await as(supertest(app).delete("/system/update"))
			expect(res.status).toBe(200)
			expect(res.body).toEqual({ error: false })
		})

		test("refuses to cancel while the host is mid-rebuild", async () => {
			mockFiles[RUNNING] = { requestedAt: "2026-08-13T00:00:00.000Z", requestedBy: "alex" }
			const res = await as(supertest(app).delete("/system/update"))
			expect(res.status).toBe(409)
			expect(res.body).toEqual({ error: true, errors: "UPDATE_IN_PROGRESS" })
		})
	})
})
