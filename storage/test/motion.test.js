const supertest = require("supertest")
const app = require("../backend/storage.js")

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")

const fs = require("fs")
const pm2 = require("pm2")

const processList = [{
	name: "motion",
	status: "online",
	restarts: 0
}]

describe("Motion Routes", () => {
	test("Unauthorized motion status", (done) => {
		supertest(app)
			.get("/motion/status")
			.expect(303, done)
	})

	test("motion status", (done) => {
		let cookieWithBearerToken =  "validCookie"
		supertest(app)
			.get("/motion/status")
			.set("Cookie", cookieWithBearerToken)
			.expect(200, processList, done)
	})
})

describe("GET /motion/sensitivity", () => {
	beforeEach(() => {
		fs.promises = { readFile: jest.fn().mockResolvedValue("daemon off\nthreshold 3000\nnoise_level 32\n") }
	})

	test("redirects unauthorized request", (done) => {
		supertest(app)
			.get("/motion/sensitivity")
			.expect(303, done)
	})

	test("returns the current threshold", async () => {
		const res = await supertest(app)
			.get("/motion/sensitivity")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ threshold: 3000 })
	})

	test("returns 500 when motion.conf has no threshold line", async () => {
		fs.promises.readFile.mockResolvedValue("daemon off\n")
		const res = await supertest(app)
			.get("/motion/sensitivity")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(500)
	})

	test("returns 500 when motion.conf is unreadable", async () => {
		fs.promises.readFile.mockRejectedValue(new Error("ENOENT"))
		const res = await supertest(app)
			.get("/motion/sensitivity")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(500)
	})
})

describe("PUT /motion/sensitivity", () => {
	beforeEach(() => {
		fs.promises = {
			readFile: jest.fn().mockResolvedValue("daemon off\nthreshold 3000\nnoise_level 32\n"),
			writeFile: jest.fn().mockResolvedValue(undefined)
		}
	})

	test("rejects non-admin requests", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "userCookie")
			.send({ threshold: 1000 })
		expect(res.status).toBe(403)
		expect(fs.promises.writeFile).not.toHaveBeenCalled()
	})

	test("rejects non-integer threshold", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "validCookie")
			.send({ threshold: "fast" })
		expect(res.status).toBe(400)
		expect(fs.promises.writeFile).not.toHaveBeenCalled()
	})

	test("rejects threshold below 1", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "validCookie")
			.send({ threshold: 0 })
		expect(res.status).toBe(400)
		expect(fs.promises.writeFile).not.toHaveBeenCalled()
	})

	test("writes the new threshold and restarts motion", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "validCookie")
			.send({ threshold: 1000 })
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ threshold: 1000, motionRestarted: true })
		expect(fs.promises.writeFile.mock.calls[0][1]).toBe("daemon off\nthreshold 1000\nnoise_level 32\n")
		expect(pm2.restart).toHaveBeenCalledWith("motion", expect.any(Function))
	})

	test("returns 502 with motionRestarted:false when the restart fails", async () => {
		pm2.restart.mockImplementationOnce((name, cb) => cb(new Error("pm2 busy")))
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "validCookie")
			.send({ threshold: 1000 })
		expect(res.status).toBe(502)
		expect(res.body).toEqual({ threshold: 1000, motionRestarted: false })
	})

	test("returns 500 when motion.conf has no threshold line", async () => {
		fs.promises.readFile.mockResolvedValue("daemon off\n")
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "validCookie")
			.send({ threshold: 1000 })
		expect(res.status).toBe(500)
		expect(fs.promises.writeFile).not.toHaveBeenCalled()
	})
})