process.env.storage_MOTION_CONF_FILEPATH = "/etc/motion/motion.conf"

jest.mock("fs", () => {
	const actual = jest.requireActual("fs")
	return {
		...actual,
		readFileSync: jest.fn((p, enc) => {
			if (p === "/etc/motion/motion.conf") return "camera_dir /etc/motion/cameraconf\n"
			if (p.endsWith("plain.conf")) return "camera_id 1\ncamera_name plain\nnetcam_url rtsp://192.168.1.1/stream\n"
			if (p.endsWith("withcreds.conf")) return "camera_id 2\ncamera_name creds\nnetcam_url rtsp://192.168.1.2/stream\nnetcam_userpass admin:pass\n"
			if (p.endsWith("dollarsign.conf")) return "camera_id 3\ncamera_name dollar\nnetcam_url rtsp://192.168.1.3/stream\nnetcam_userpass admin:p$1x$$end\n"
			return actual.readFileSync(p, enc)
		}),
		readdirSync: jest.fn((p) => {
			if (p === "/etc/motion/cameraconf") return ["plain.conf", "withcreds.conf", "dollarsign.conf"]
			return actual.readdirSync(p)
		})
	}
})

const path = require("path")
const { loadCameras } = require("../utils/loadCameras")

describe("loadCameras full_url", () => {
	let cams

	beforeAll(() => { cams = loadCameras() })

	test("no netcam_userpass: full_url equals rtsp_url", () => {
		const cam = cams.find(c => c.name === "plain")
		expect(cam.full_url).toBe("rtsp://192.168.1.1/stream")
	})

	test("with netcam_userpass: injects creds after scheme", () => {
		const cam = cams.find(c => c.name === "creds")
		expect(cam.full_url).toBe("rtsp://admin:pass@192.168.1.2/stream")
	})

	test("password containing $ is URI encoded correctly", () => {
		const cam = cams.find(c => c.name === "dollar")
		expect(cam.full_url).toBe("rtsp://admin:p%241x%24%24end@192.168.1.3/stream")
	})
})

describe("loadCameras relative camera_dir", () => {
	const origEnv = process.env.storage_MOTION_CONF_FILEPATH
	const confPath = "/tmp/test/motion.conf"
	const expectedCamDir = path.resolve(path.dirname(confPath), "cams")

	beforeEach(() => {
		process.env.storage_MOTION_CONF_FILEPATH = confPath
		const { readFileSync, readdirSync } = require("fs")
		readFileSync.mockImplementation((p) => {
			if (p === confPath) return "camera_dir cams\n"
			if (String(p).endsWith("cam1.conf")) return "camera_id 1\ncamera_name test\nnetcam_url rtsp://1.1.1.1/stream\n"
			return ""
		})
		readdirSync.mockImplementation((p) => (p === expectedCamDir ? ["cam1.conf"] : []))
	})

	afterEach(() => { process.env.storage_MOTION_CONF_FILEPATH = origEnv })

	test("resolves relative camera_dir against motion.conf directory", () => {
		const cams = loadCameras()
		expect(cams).toHaveLength(1)
		expect(cams[0].name).toBe("test")
	})
})

describe("loadCameras URL filter", () => {
	beforeEach(() => {
		const { readFileSync, readdirSync } = require("fs")
		readFileSync.mockImplementation((p) => {
			if (p === "/etc/motion/motion.conf") return "camera_dir /etc/motion/cameraconf\n"
			if (p.endsWith("valid.conf")) return "camera_id 1\ncamera_name valid\nnetcam_url rtsp://1.1.1.1/stream\n"
			if (p.endsWith("nourl.conf")) return "camera_id 2\ncamera_name nourl\n"
			if (p.endsWith("badurl.conf")) return "camera_id 3\ncamera_name badurl\nnetcam_url not-a-url\n"
			return ""
		})
		readdirSync.mockImplementation((p) => (p === "/etc/motion/cameraconf" ? ["valid.conf", "nourl.conf", "badurl.conf"] : []))
	})

	test("excludes cameras with missing or invalid netcam_url", () => {
		const cams = loadCameras()
		expect(cams).toHaveLength(1)
		expect(cams[0].name).toBe("valid")
	})
})
