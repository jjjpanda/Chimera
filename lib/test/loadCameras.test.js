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

	test("password containing $ is not interpolated as replacement pattern", () => {
		const cam = cams.find(c => c.name === "dollar")
		expect(cam.full_url).toBe("rtsp://admin:p$1x$$end@192.168.1.3/stream")
	})
})
