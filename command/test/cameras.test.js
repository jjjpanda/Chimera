process.env.SECRETKEY = "test-secret"
process.env.storage_MOTION_CONF_FILEPATH = "/etc/motion/motion.conf"

jest.mock("fs", () => {
	const actual = jest.requireActual("fs")
	return {
		...actual,
		readFileSync: jest.fn((p, enc) => {
			if (p === "/etc/motion/motion.conf") return "camera_dir /etc/motion/cameraconf\n"
			if (p.endsWith("cam1.conf")) return "camera_id 1\ncamera_name indoor\nnetcam_url rtsp://1.1.1.1/cam\n"
			if (p.endsWith("cam2.conf")) return "camera_id 2\ncamera_name outdoor\nnetcam_url rtsp://user:secret@2.2.2.2/cam\n"
			return actual.readFileSync(p, enc)
		}),
		readdirSync: jest.fn((p) => {
			if (p === "/etc/motion/cameraconf") return ["cam1.conf", "cam2.conf"]
			return actual.readdirSync(p)
		})
	}
})

jest.mock("pg")
jest.mock("pm2")
jest.mock("axios")
jest.mock("memory")

const supertest = require("supertest")
const jwt = require("jsonwebtoken")
const app = require("../backend/command.js")

const { mockedPool } = require("pg")

describe("Cameras Route", () => {
	describe("GET /cameras", () => {
		test("redirects to login with no token", async () => {
			const res = await supertest(app).get("/cameras/")
			expect(res.status).toBe(303)
		})

		test("returns 200 with id+name+rtsp_url list and strips embedded credentials", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [{ role: "user" }], rowCount: 1 })
			const token = jwt.sign({ username: "test", role: "user" }, "test-secret")
			const res = await supertest(app)
				.get("/cameras/")
				.set("Cookie", `bearertoken=Bearer%20${token}`)
			expect(res.status).toBe(200)
			expect(res.body).toEqual([
				{ id: 1, name: "indoor", rtsp_url: "rtsp://1.1.1.1/cam" },
				{ id: 2, name: "outdoor", rtsp_url: "rtsp://2.2.2.2/cam" }
			])
		})
	})
})
