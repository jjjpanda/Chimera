const supertest = require("supertest")
const app = require("../backend/storage.js")

const moment = require("moment")
var {parseFileName, validateDays, validateRequest}    = require("../backend/routes/lib/converter.js")
const dateFormat = require("../backend/routes/lib/dateFormat.js")

const fileList = [
	"20210101-000000-00.jpg",
	"20210101-030000-00.jpg",
	"20210101-060000-00.jpg",
	"20210101-090000-00.jpg",
	"20210101-120000-00.jpg",
	"20210101-150000-00.jpg",
	"20210101-180000-00.jpg",
	"20210101-210000-00.jpg",
	"20210102-000000-00.jpg",
	"output_1_20210101-235959_20210201-235959_video1-20210301-235959.mp4", 
	"output_1_20210101-235959_20210201-235959_video2-20210301-235959.mp4",
	"output_1_20210101-235959_20210201-235959_video3-20210301-235959.mp4",
	"mp4_video3-20210301-235959.txt",
	"output_1_20210101-235959_20210201-235959_zip1-20210301-235959.zip",
	"malformed_video.mp4",
]

const listOfProcesses = fileList.filter(file => file.includes(".mp4") || file.includes(".zip")).map((file) => {
	const obj = parseFileName(file)
	if (obj.error) return null
	return {
		...obj,
		running: obj.id.includes("video3"),
		size: 1024
	}
}).filter(Boolean)

const listOfImages = fileList.filter(file => file.includes(".jpg")).map(file => `/shared/captures/1/${file}`)

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")

describe("Convert Routes", () => {
	let cookieWithBearerToken = "validCookie"

	describe("/convert/createVideo", () => {
		test("returns 401 with no cookie", (done) => {
			supertest(app)
				.post("/convert/createVideo")
				.send({})
				.expect(401, done)
		})

		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/convert/createVideo")
				.send({})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})

		test("clamps out-of-range and non-numeric fps", () => {
			const { clampFPS } = require("../backend/routes/lib/video.js")
			expect(clampFPS(120)).toBe(60)
			expect(clampFPS(0)).toBe(1)
			expect(clampFPS(-5)).toBe(1)
			expect(clampFPS(24)).toBe(24)
			expect(clampFPS("abc")).toBe(20)
			expect(clampFPS(undefined)).toBe(20)
		})
	})

	describe("/convert/listFramesVideo", () => {
		test("get list of frame with a camera number", (done) => {
			supertest(app)
				.post("/convert/listFramesVideo")
				.send({bruh: true})
				.set("Cookie", cookieWithBearerToken)
				.expect(400, { error: true, msg: "no camera" }, done)
		})

		test("rejects a non-numeric camera (path traversal)", (done) => {
			supertest(app)
				.post("/convert/listFramesVideo")
				.send({ start: "20210101-000000", end: "20210102-000000", camera: "../../../etc" })
				.set("Cookie", cookieWithBearerToken)
				.expect(400, { error: true, msg: "invalid camera" }, done)
		})

		test("get list of frames between dates", (done) => {
			supertest(app)
				.post("/convert/listFramesVideo")
				.send({start: "20210101-000000", end: "20210102-000000", camera: 1})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { list: listOfImages }, done)
		})

		test("get list of frames between dates with no frames available", (done) => {
			supertest(app)
				.post("/convert/listFramesVideo")
				.send({start: "20210101-000000", end: "20210102-000000", camera: 2})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { list: [] }, done)
		})

		test("get list of only 3 frames between dates", (done) => {
			supertest(app)
				.post("/convert/listFramesVideo")
				.send({start: "20210101-000000", end: "20210102-000000", camera: 1, frames: 3})
				.set("Cookie", cookieWithBearerToken)
				.expect(200)
				.then(({body}) => {
					if(body && body.list && body.list.length == 3) done()
					else done("list should have 3 items")
				})
		})
	})

	describe("/convert/createZip", () => {
		test("returns 401 with no cookie", (done) => {
			supertest(app)
				.post("/convert/createZip")
				.send({})
				.expect(401, done)
		})

		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/convert/createZip")
				.send({})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})
	})

	describe("validateDays window", () => {
		test("hours sets a start/end window ending now", () => {
			const req = { body: { hours: 5 } }
			const next = jest.fn()
			validateDays(req, {}, next)
			const start = moment(req.body.start, dateFormat)
			const end = moment(req.body.end, dateFormat)
			expect(end.diff(start, "hours")).toBe(5)
			expect(next).toHaveBeenCalled()
		})

		test("days sets a start/end window ending now", () => {
			const req = { body: { days: 2 } }
			const next = jest.fn()
			validateDays(req, {}, next)
			const start = moment(req.body.start, dateFormat)
			const end = moment(req.body.end, dateFormat)
			expect(end.diff(start, "days")).toBe(2)
			expect(next).toHaveBeenCalled()
		})

		test("hours takes precedence over days", () => {
			const req = { body: { hours: 1, days: 30 } }
			const next = jest.fn()
			validateDays(req, {}, next)
			const start = moment(req.body.start, dateFormat)
			const end = moment(req.body.end, dateFormat)
			expect(end.diff(start, "hours")).toBe(1)
			expect(next).toHaveBeenCalled()
		})

		test("neither leaves the window untouched", () => {
			const req = { body: { camera: 1 } }
			const next = jest.fn()
			validateDays(req, {}, next)
			expect(req.body.start).toBeUndefined()
			expect(req.body.end).toBeUndefined()
			expect(next).toHaveBeenCalled()
		})
	})

	describe("validateRequest window", () => {
		test("dateless request writes a default start/end back to req.body instead of leaving them undefined", () => {
			const req = { body: { camera: 1 } }
			const next = jest.fn()
			validateRequest(req, {}, next)
			expect(req.body.start).not.toBeUndefined()
			expect(req.body.end).not.toBeUndefined()
			expect(() => req.body.start.split("-")).not.toThrow()
			expect(next).toHaveBeenCalled()
		})
	})

	describe("/convert/createVideo with no dates", () => {
		test("dateless request does not crash the storage process", (done) => {
			supertest(app)
				.post("/convert/createVideo")
				.send({camera: 1})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, done)
		})
	})

	describe("/convert/createZip with no dates", () => {
		test("dateless request does not crash the storage process", (done) => {
			supertest(app)
				.post("/convert/createZip")
				.send({camera: 1})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, done)
		})
	})

	describe("parseFileName guard", () => {
		test("returns error for malformed filename", () => {
			const result = parseFileName("malformed_file.mp4")
			expect(result.error).toBe(true)
		})
	})

	describe("/convert/listFramesVideo with hours", () => {
		test("hours window flows through the middleware chain", (done) => {
			supertest(app)
				.post("/convert/listFramesVideo")
				.send({ camera: 1, hours: 5 })
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { list: [] }, done)
		})
	})

	describe("/convert/statusProcess", () => {
		test("check status of a running process", (done) => {
			const id = "video3-20210301-235959"
			supertest(app)
				.post("/convert/statusProcess")
				.send({id})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { running: true, id }, done)
		})

		test("check status of a finished process", (done) => {
			const id = "video1-20210301-235959"
			supertest(app)
				.post("/convert/statusProcess")
				.send({id})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { running: false, id }, done)
		})

		test("check status of a nonexistent process", (done) => {
			const id = "video1-19990301-235959"
			supertest(app)
				.post("/convert/statusProcess")
				.send({id})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { running: false, id }, done)
		})

		test("check status of a process whose id contains parentheses", (done) => {
			const id = "vid(eo)1-20210301-235959"
			supertest(app)
				.post("/convert/statusProcess")
				.send({id})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { running: false, id }, done)
		})

		test("check status with no id", (done) => {
			supertest(app)
				.post("/convert/statusProcess")
				.send({bruh: true})
				.set("Cookie", cookieWithBearerToken)
				.expect(400, { error: true, msg: "no id" }, done)
		})

		test("rejects an id with path traversal", (done) => {
			supertest(app)
				.post("/convert/statusProcess")
				.send({id: "../bruh"})
				.set("Cookie", cookieWithBearerToken)
				.expect(400, { error: true, msg: "no id" }, done)
		})

		test("rejects an id with a null byte", (done) => {
			supertest(app)
				.post("/convert/statusProcess")
				.send({id: "video1\u0000-20210301-235959"})
				.set("Cookie", cookieWithBearerToken)
				.expect(400, { error: true, msg: "no id" }, done)
		})

		test("check status with a blank id", (done) => {
			supertest(app)
				.post("/convert/statusProcess")
				.send({id: "   "})
				.set("Cookie", cookieWithBearerToken)
				.expect(400, { error: true, msg: "no id" }, done)
		})

		test("check status with a non-string id", (done) => {
			supertest(app)
				.post("/convert/statusProcess")
				.send({id: 5})
				.set("Cookie", cookieWithBearerToken)
				.expect(400, { error: true, msg: "no id" }, done)
		})
	})

	describe("/convert/cancelProcess", () => {
		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/convert/cancelProcess")
				.send({id: "video3-20210301-235959"})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})

		test("cancel a process", (done) => {
			const id = "video3-20210301-235959"
			supertest(app)
				.post("/convert/cancelProcess")
				.send({id})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { cancelled: true, id }, done)
		})

		test("cancel a process that doesn't exist", (done) => {
			const id = "not_an_id"
			supertest(app)
				.post("/convert/cancelProcess")
				.send({id})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { cancelled: false, id }, done)
		})
	})

	describe("/convert/listProcess", () => {
		test("list processes", (done) => {
			supertest(app)
				.get("/convert/listProcess")
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { list: listOfProcesses }, done)
		})
	})

	describe("/convert/deleteProcess", () => {
		test("returns 403 for non-admin", (done) => {
			supertest(app)
				.post("/convert/deleteProcess")
				.send({id: "video1-20210301-235959"})
				.set("Cookie", "userCookie")
				.expect(403, done)
		})

		test("delete a process", (done) => {
			const id = "video1-20210301-235959"
			supertest(app)
				.post("/convert/deleteProcess")
				.send({id})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { deleted: true, id }, done)
		})

		test("delete a process that doesn't exist", (done) => {
			const id = "not-an-id"
			supertest(app)
				.post("/convert/deleteProcess")
				.send({id})
				.set("Cookie", cookieWithBearerToken)
				.expect(200, { deleted: false, id }, done)
		})
	})

	describe("zip save-path output error", () => {
		const { EventEmitter } = require("events")
		const fs = require("fs")
		const lib = require("lib")
		const { zip } = require("../backend/routes/lib/zip.js")

		test("alerts exactly once when the output stream errors and dedups repeats", () => {
			lib.webhookAlert.mockClear()
			const output = new EventEmitter()
			const writeStreamSpy = jest.spyOn(fs, "createWriteStream").mockReturnValue(output)
			const writeFileSpy = jest.spyOn(fs, "writeFile").mockImplementation((p, d, cb) => cb && cb())
			const archive = Object.assign(new EventEmitter(), { pipe: jest.fn(), finalize: jest.fn(), abort: jest.fn() })

			zip(archive, 1, 5, "20210101-000000", "20210102-000000", true, { body: {} }, { send: jest.fn() })

			output.emit("error", new Error("ENOSPC: no space left on device"))
			output.emit("error", new Error("ENOSPC: no space left on device"))

			const failureCalls = lib.webhookAlert.mock.calls.filter(c => /could not be completed/.test(c[0]))
			expect(failureCalls).toHaveLength(1)

			writeStreamSpy.mockRestore()
			writeFileSpy.mockRestore()
		})
	})

	describe("zip streaming (non-save) branch error handling", () => {
		const { EventEmitter } = require("events")
		const { zip } = require("../backend/routes/lib/zip.js")

		test("sends a 500 on archive error when nothing has been written yet", () => {
			const archive = Object.assign(new EventEmitter(), { pipe: jest.fn(), finalize: jest.fn(), abort: jest.fn() })
			const end = jest.fn()
			const res = { attachment: jest.fn(), send: jest.fn(), destroy: jest.fn(), headersSent: false, status: jest.fn(() => ({ end })) }

			zip(archive, 1, 5, "20210101-000000", "20210102-000000", false, { body: {} }, res)

			expect(() => archive.emit("error", new Error("EPIPE"))).not.toThrow()
			expect(res.status).toHaveBeenCalledWith(500)
			expect(end).toHaveBeenCalled()
			expect(res.destroy).not.toHaveBeenCalled()
		})

		test("destroys the response on archive error once headers are already sent so the client does not hang", () => {
			const archive = Object.assign(new EventEmitter(), { pipe: jest.fn(), finalize: jest.fn(), abort: jest.fn() })
			const res = { attachment: jest.fn(), send: jest.fn(), destroy: jest.fn(), headersSent: true, status: jest.fn() }
			const err = new Error("EPIPE")

			zip(archive, 1, 5, "20210101-000000", "20210102-000000", false, { body: {} }, res)

			expect(() => archive.emit("error", err)).not.toThrow()
			expect(res.destroy).toHaveBeenCalledWith(err)
			expect(res.status).not.toHaveBeenCalled()
		})
	})

	describe("createVideo frame-list write failure", () => {
		const fs = require("fs")
		const { createVideo } = require("../backend/routes/lib/video.js")

		test("returns {error:true} instead of throwing when the frame-list write fails", () => {
			const writeFileSpy = jest.spyOn(fs, "writeFile").mockImplementation((p, d, cb) => cb(new Error("ENOSPC")))
			const req = { body: { camera: "1", start: "20210101-000000", end: "20210102-000000" } }
			const res = { send: jest.fn() }

			expect(() => createVideo(req, res)).not.toThrow()
			expect(res.send).toHaveBeenCalledWith({ error: true })

			writeFileSpy.mockRestore()
		})
	})
})