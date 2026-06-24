const supertest = require("supertest")
const app = require("../backend/storage.js")

const moment = require("moment")
var {generateID, fileName, parseFileName, validateDays}    = require("../backend/routes/lib/converter.js")
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
]

const listOfProcesses = fileList.filter(file => file.includes(".mp4") || file.includes(".zip")).map((file) => {
	const obj = parseFileName(file)
	return {
		...obj,
		running: obj.id.includes("video3"),
		size: 1024
	}
})

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

		test("check status with no id", (done) => {
			supertest(app)
				.post("/convert/statusProcess")
				.send({bruh: true})
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
				.expect(200, { cancelled: true, id }, done)
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
})