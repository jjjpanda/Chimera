process.env.storage_MOTION_CONF_FILEPATH = "/etc/motion/motion.conf"
const supertest = require("supertest")
const app = require("../backend/storage.js")

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")

const fs = require("fs")
const pm2 = require("pm2")
const lib = require("lib")

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
		lib.loadCameras.mockResolvedValue([])
		lib.cameraConfFiles.mockResolvedValue([])
	})

	test("redirects unauthorized request", (done) => {
		supertest(app)
			.get("/motion/sensitivity")
			.expect(303, done)
	})

	test("returns the current threshold and camera list", async () => {
		lib.loadCameras.mockResolvedValue([
			{ id: 1, name: "indoor" },
			{ id: 2, name: "outdoor" }
		])
		lib.cameraConfFiles.mockImplementation(async (id) => {
			return id === 1 ? ["/etc/motion/cameraconf/cam1.conf"] : ["/etc/motion/cameraconf/cam2.conf"]
		})
		fs.promises.readFile.mockImplementation(async (filePath) => {
			if (filePath.includes("cam1.conf")) return "camera_id 1\nthreshold 1200\n"
			if (filePath.includes("cam2.conf")) return "camera_id 2\n"
			return "daemon off\nthreshold 3000\nnoise_level 32\n"
		})

		const res = await supertest(app)
			.get("/motion/sensitivity")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(200)
		expect(res.body.threshold).toBe(3000)
		expect(res.body.defaultThreshold).toBe(3000)
		expect(res.body.cameras).toEqual([
			{ id: 1, name: "indoor", threshold: 1200, isCustom: true },
			{ id: 2, name: "outdoor", threshold: 3000, isCustom: false }
		])
	})

	test("falls back to default threshold if reading a camera config fails", async () => {
		lib.loadCameras.mockResolvedValue([
			{ id: 1, name: "indoor" },
			{ id: 2, name: "outdoor" }
		])
		lib.cameraConfFiles.mockImplementation(async (id) => {
			return id === 1 ? ["/etc/motion/cameraconf/cam1.conf"] : ["/etc/motion/cameraconf/cam2.conf"]
		})
		fs.promises.readFile.mockImplementation(async (filePath) => {
			if (filePath.includes("cam1.conf")) throw new Error("EACCES")
			if (filePath.includes("cam2.conf")) return "camera_id 2\nthreshold 500\n"
			return "daemon off\nthreshold 3000\nnoise_level 32\n"
		})

		const res = await supertest(app)
			.get("/motion/sensitivity")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(200)
		expect(res.body.cameras).toEqual([
			{ id: 1, name: "indoor", threshold: 3000, isCustom: false },
			{ id: 2, name: "outdoor", threshold: 500, isCustom: true }
		])
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

describe("GET /motion/sensitivity/:id", () => {
	beforeEach(() => {
		fs.promises = { readFile: jest.fn().mockResolvedValue("daemon off\nthreshold 3000\nnoise_level 32\n") }
		lib.cameraConfFiles.mockResolvedValue([])
	})

	test("rejects non-numeric camera id", async () => {
		const res = await supertest(app)
			.get("/motion/sensitivity/abc")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(400)
	})

	test("returns 404 when camera has no config file", async () => {
		const res = await supertest(app)
			.get("/motion/sensitivity/99")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(404)
	})

	test("returns custom threshold when camera config has threshold", async () => {
		lib.cameraConfFiles.mockResolvedValue(["/etc/motion/cameraconf/cam1.conf"])
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file && file.includes("cam1.conf")) return "camera_id 1\nthreshold 800\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.get("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ id: 1, threshold: 800, defaultThreshold: 3000, isCustom: true })
	})

	test("returns custom threshold when camera config has indented threshold", async () => {
		lib.cameraConfFiles.mockResolvedValue(["/etc/motion/cameraconf/cam1.conf"])
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file && file.includes("cam1.conf")) return "camera_id 1\n  threshold 800\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.get("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ id: 1, threshold: 800, defaultThreshold: 3000, isCustom: true })
	})

	test("returns default threshold when camera config has no threshold", async () => {
		lib.cameraConfFiles.mockResolvedValue(["/etc/motion/cameraconf/cam2.conf"])
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file && file.includes("cam2.conf")) return "camera_id 2\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.get("/motion/sensitivity/2")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ id: 2, threshold: 3000, defaultThreshold: 3000, isCustom: false })
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

	test("rejects missing body", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "validCookie")
		expect(res.status).toBe(400)
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
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			process.env.storage_MOTION_CONF_FILEPATH,
			"daemon off\nthreshold 1000\nnoise_level 32\n"
		)
		expect(pm2.restart).toHaveBeenCalledWith("motion", expect.any(Function))
	})

	test("replaces threshold line and strips trailing comment", async () => {
		fs.promises.readFile.mockResolvedValue("daemon off\nthreshold 3000 # motion sensitivity\nnoise_level 32\n")
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "validCookie")
			.send({ threshold: 1200 })
		expect(res.status).toBe(200)
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			process.env.storage_MOTION_CONF_FILEPATH,
			"daemon off\nthreshold 1200\nnoise_level 32\n"
		)
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

	test("returns 500 when writing file fails", async () => {
		fs.promises.writeFile.mockRejectedValue(new Error("disk full"))
		const res = await supertest(app)
			.put("/motion/sensitivity")
			.set("Cookie", "validCookie")
			.send({ threshold: 1000 })
		expect(res.status).toBe(500)
	})
})

describe("PUT /motion/sensitivity/:id", () => {
	beforeEach(() => {
		fs.promises = {
			readFile: jest.fn().mockImplementation(async (file) => {
				if (file && file.includes("cam1.conf")) return "camera_id 1\nnetcam_url rtsp://...\n"
				return "daemon off\nthreshold 3000\n"
			}),
			writeFile: jest.fn().mockResolvedValue(undefined)
		}
		lib.cameraConfFiles.mockResolvedValue(["/etc/motion/cameraconf/cam1.conf"])
	})

	test("rejects non-admin requests", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "userCookie")
			.send({ threshold: 800 })
		expect(res.status).toBe(403)
		expect(fs.promises.writeFile).not.toHaveBeenCalled()
	})

	test("rejects invalid camera id", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity/abc")
			.set("Cookie", "validCookie")
			.send({ threshold: 800 })
		expect(res.status).toBe(400)
	})

	test("rejects invalid threshold when not reset", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
			.send({ threshold: "high" })
		expect(res.status).toBe(400)
	})

	test("returns 404 when camera conf file is missing", async () => {
		lib.cameraConfFiles.mockResolvedValue([])
		const res = await supertest(app)
			.put("/motion/sensitivity/99")
			.set("Cookie", "validCookie")
			.send({ threshold: 800 })
		expect(res.status).toBe(404)
	})

	test("appends custom threshold to camera conf and restarts motion", async () => {
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
			.send({ threshold: 800 })
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ id: 1, threshold: 800, isCustom: true, motionRestarted: true })
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			"/etc/motion/cameraconf/cam1.conf",
			"camera_id 1\nnetcam_url rtsp://...\nthreshold 800\n",
			"utf8"
		)
		expect(pm2.restart).toHaveBeenCalledWith("motion", expect.any(Function))
	})

	test("updates existing custom threshold in camera conf", async () => {
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file.includes("cam1.conf")) return "camera_id 1\nthreshold 500\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
			.send({ threshold: 900 })
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ id: 1, threshold: 900, isCustom: true, motionRestarted: true })
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			"/etc/motion/cameraconf/cam1.conf",
			"camera_id 1\nthreshold 900\n",
			"utf8"
		)
	})

	test("updates indented custom threshold in camera conf", async () => {
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file.includes("cam1.conf")) return "camera_id 1\n  threshold 500\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
			.send({ threshold: 900 })
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ id: 1, threshold: 900, isCustom: true, motionRestarted: true })
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			"/etc/motion/cameraconf/cam1.conf",
			"camera_id 1\nthreshold 900\n",
			"utf8"
		)
	})

	test("removes threshold when reset: true, reverting to default", async () => {
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file.includes("cam1.conf")) return "camera_id 1\nthreshold 500\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
			.send({ reset: true })
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ id: 1, threshold: 3000, isCustom: false, motionRestarted: true })
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			"/etc/motion/cameraconf/cam1.conf",
			"camera_id 1\n",
			"utf8"
		)
	})

	test("removes all threshold lines when reset: true and multiple exist", async () => {
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file.includes("cam1.conf")) return "camera_id 1\nthreshold 500\nthreshold 800\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
			.send({ reset: true })
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ id: 1, threshold: 3000, isCustom: false, motionRestarted: true })
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			"/etc/motion/cameraconf/cam1.conf",
			"camera_id 1\n",
			"utf8"
		)
	})

	test("updates existing custom threshold and strips trailing comment", async () => {
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file.includes("cam1.conf")) return "camera_id 1\nthreshold 500 # cam override\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
			.send({ threshold: 900 })
		expect(res.status).toBe(200)
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			"/etc/motion/cameraconf/cam1.conf",
			"camera_id 1\nthreshold 900\n",
			"utf8"
		)
	})

	test("removes threshold and trailing comment when reset: true", async () => {
		fs.promises.readFile.mockImplementation(async (file) => {
			if (file.includes("cam1.conf")) return "camera_id 1\nthreshold 500 # cam override\n"
			return "daemon off\nthreshold 3000\n"
		})
		const res = await supertest(app)
			.put("/motion/sensitivity/1")
			.set("Cookie", "validCookie")
			.send({ reset: true })
		expect(res.status).toBe(200)
		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			"/etc/motion/cameraconf/cam1.conf",
			"camera_id 1\n",
			"utf8"
		)
	})
})