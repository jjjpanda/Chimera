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
		}),
		promises: {
			readFile: jest.fn((p, enc) => {
				if (p === "/etc/motion/motion.conf") return Promise.resolve("camera_dir /etc/motion/cameraconf\n")
				if (p.endsWith("plain.conf")) return Promise.resolve("camera_id 1\ncamera_name plain\nnetcam_url rtsp://192.168.1.1/stream\n")
				if (p.endsWith("withcreds.conf")) return Promise.resolve("camera_id 2\ncamera_name creds\nnetcam_url rtsp://192.168.1.2/stream\nnetcam_userpass admin:pass\n")
				if (p.endsWith("dollarsign.conf")) return Promise.resolve("camera_id 3\ncamera_name dollar\nnetcam_url rtsp://192.168.1.3/stream\nnetcam_userpass admin:p$1x$$end\n")
				return Promise.resolve(actual.readFileSync(p, enc))
			}),
			readdir: jest.fn((p) => {
				if (p === "/etc/motion/cameraconf") return Promise.resolve(["plain.conf", "withcreds.conf", "dollarsign.conf"])
				return Promise.resolve(actual.readdirSync(p))
			})
		}
	}
})

const path = require("path")
const { loadCameras, loadCamerasSync, cameraConfFiles, cameraConfDirSync } = require("../utils/loadCameras")

describe("loadCameras full_url", () => {
	let cams

	beforeAll(async () => { cams = await loadCameras() })

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
		const { readFileSync, readdirSync, promises } = require("fs")
		readFileSync.mockImplementation((p) => {
			if (p === confPath) return "camera_dir cams\n"
			if (String(p).endsWith("cam1.conf")) return "camera_id 1\ncamera_name test\nnetcam_url rtsp://1.1.1.1/stream\n"
			return ""
		})
		readdirSync.mockImplementation((p) => (p === expectedCamDir ? ["cam1.conf"] : []))
		promises.readFile.mockImplementation((p) => Promise.resolve(readFileSync(p)))
		promises.readdir.mockImplementation((p) => Promise.resolve(readdirSync(p)))
	})

	afterEach(() => { process.env.storage_MOTION_CONF_FILEPATH = origEnv })

	test("resolves relative camera_dir against motion.conf directory", async () => {
		const cams = await loadCameras()
		expect(cams).toHaveLength(1)
		expect(cams[0].name).toBe("test")
	})
})

describe("loadCameras URL filter", () => {
	beforeEach(() => {
		const { readFileSync, readdirSync, promises } = require("fs")
		readFileSync.mockImplementation((p) => {
			if (p === "/etc/motion/motion.conf") return "camera_dir /etc/motion/cameraconf\n"
			if (p.endsWith("valid.conf")) return "camera_id 1\ncamera_name valid\nnetcam_url rtsp://1.1.1.1/stream\n"
			if (p.endsWith("nourl.conf")) return "camera_id 2\ncamera_name nourl\n"
			if (p.endsWith("badurl.conf")) return "camera_id 3\ncamera_name badurl\nnetcam_url not-a-url\n"
			if (p.endsWith("badport.conf")) return "camera_id 4\ncamera_name badport\nnetcam_url rtsp://1.1.1.1:99999/stream\n"
			if (p.endsWith("embeddedcreds.conf")) return "camera_id 5\ncamera_name embeddedcreds\nnetcam_url rtsp://user:pass@1.1.1.1/stream\n"
			return ""
		})
		readdirSync.mockImplementation((p) => (p === "/etc/motion/cameraconf" ? ["valid.conf", "nourl.conf", "badurl.conf", "badport.conf", "embeddedcreds.conf"] : []))
		promises.readFile.mockImplementation((p) => Promise.resolve(readFileSync(p)))
		promises.readdir.mockImplementation((p) => Promise.resolve(readdirSync(p)))
	})

	test("excludes cameras with missing or invalid netcam_url", async () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {})
		const cams = await loadCameras()
		expect(cams).toHaveLength(1)
		expect(cams[0].name).toBe("valid")
		spy.mockRestore()
	})

	test("excludes camera with credentials embedded in netcam_url", async () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {})
		const cams = await loadCameras()
		expect(cams.find(c => c.name === "embeddedcreds")).toBeUndefined()
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("netcam_userpass"))
		spy.mockRestore()
	})

	test("excludes camera whose url passes the scheme regex but fails new URL()", async () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {})
		const cams = await loadCameras()
		expect(cams.find(c => c.name === "badport")).toBeUndefined()
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Invalid URL for camera badport"))
		spy.mockRestore()
	})
})

describe("loadCameras I/O failures", () => {
	beforeEach(() => {
		process.env.storage_MOTION_CONF_FILEPATH = "/etc/motion/motion.conf"
		const { promises } = require("fs")
		promises.readFile.mockImplementation((p) => p === "/etc/motion/motion.conf"
			? Promise.resolve("camera_dir /etc/motion/cameraconf\n")
			: Promise.resolve("camera_id 1\ncamera_name plain\nnetcam_url rtsp://1.1.1.1/s\n"))
		promises.readdir.mockResolvedValue(["plain.conf"])
	})

	test("rejects instead of reporting zero cameras when motion.conf is unreadable", async () => {
		require("fs").promises.readFile.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }))
		await expect(loadCameras()).rejects.toThrow("EACCES")
	})

	test("rejects instead of reporting zero cameras when the conf dir is unreadable", async () => {
		require("fs").promises.readdir.mockRejectedValue(Object.assign(new Error("EIO"), { code: "EIO" }))
		await expect(loadCameras()).rejects.toThrow("EIO")
	})

	test("rejects when a conf is unlinked between readdir and readFile", async () => {
		const { promises } = require("fs")
		promises.readdir.mockResolvedValue(["cam1.conf", "cam2.conf"])
		promises.readFile.mockImplementation((p) => {
			if (p === "/etc/motion/motion.conf") return Promise.resolve("camera_dir /etc/motion/cameraconf\n")
			if (String(p).endsWith("cam2.conf")) return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
			return Promise.resolve("camera_id 1\ncamera_name one\nnetcam_url rtsp://1.1.1.1/s\n")
		})
		await expect(loadCameras()).rejects.toThrow("ENOENT")
	})

	test("returns [] when storage_MOTION_CONF_FILEPATH is unset", async () => {
		delete process.env.storage_MOTION_CONF_FILEPATH
		await expect(loadCameras()).resolves.toEqual([])
	})
})

describe("cameraConfFiles", () => {
	beforeEach(() => {
		process.env.storage_MOTION_CONF_FILEPATH = "/etc/motion/motion.conf"
		const { readFileSync, readdirSync, promises } = require("fs")
		readFileSync.mockImplementation((p) => {
			if (p === "/etc/motion/motion.conf") return "camera_dir /etc/motion/cameraconf\n"
			if (p.endsWith("frontdoor.conf")) return "camera_id 7\ncamera_name front\nnetcam_url rtsp://1.1.1.1/s\n"
			if (p.endsWith("cam2.conf")) return "camera_id 2\ncamera_name two\nnetcam_url rtsp://2.2.2.2/s\n"
			return ""
		})
		readdirSync.mockImplementation((p) => (p === "/etc/motion/cameraconf" ? ["frontdoor.conf", "cam2.conf"] : []))
		promises.readFile.mockImplementation((p) => Promise.resolve(readFileSync(p)))
		promises.readdir.mockImplementation((p) => Promise.resolve(readdirSync(p)))
	})

	test("matches a conf by its in-file camera_id, not its filename", async () => {
		expect(await cameraConfFiles(7)).toEqual([path.join("/etc/motion/cameraconf", "frontdoor.conf")])
	})

	test("returns [] when no conf declares that camera_id", async () => {
		expect(await cameraConfFiles(99)).toEqual([])
	})

	test("rejects instead of reporting no matching conf when motion.conf is unreadable", async () => {
		require("fs").promises.readFile.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }))
		await expect(cameraConfFiles(7)).rejects.toThrow("EACCES")
	})

	test("rejects instead of reporting no matching conf when the conf dir is unreadable", async () => {
		require("fs").promises.readdir.mockRejectedValue(Object.assign(new Error("EIO"), { code: "EIO" }))
		await expect(cameraConfFiles(7)).rejects.toThrow("EIO")
	})
})

describe("loadCamerasSync (pm2 livestream startup path)", () => {
	beforeEach(() => {
		process.env.storage_MOTION_CONF_FILEPATH = "/etc/motion/motion.conf"
		const { readFileSync, readdirSync } = require("fs")
		readFileSync.mockImplementation((p) => {
			if (p === "/etc/motion/motion.conf") return "camera_dir /etc/motion/cameraconf\n"
			if (p.endsWith("plain.conf")) return "camera_id 1\ncamera_name plain\nnetcam_url rtsp://192.168.1.1/stream\n"
			if (p.endsWith("creds.conf")) return "camera_id 2\ncamera_name creds\nnetcam_url rtsp://192.168.1.2/stream\nnetcam_userpass admin:pass\n"
			if (p.endsWith("embedded.conf")) return "camera_id 3\ncamera_name embeddedcreds\nnetcam_url rtsp://user:pass@1.1.1.1/stream\n"
			return ""
		})
		readdirSync.mockImplementation((p) => (p === "/etc/motion/cameraconf" ? ["creds.conf", "plain.conf", "embedded.conf"] : []))
	})

	test("loads valid cameras sorted by id, encodes creds, and drops embedded-cred urls", () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {})
		const cams = loadCamerasSync()
		expect(cams.map(c => c.name)).toEqual(["plain", "creds"])
		expect(cams.find(c => c.name === "creds").full_url).toBe("rtsp://admin:pass@192.168.1.2/stream")
		spy.mockRestore()
	})

	test("returns [] when storage_MOTION_CONF_FILEPATH is unset", () => {
		delete process.env.storage_MOTION_CONF_FILEPATH
		expect(loadCamerasSync()).toEqual([])
	})
})

describe("cameraConfDirSync relative camera_dir", () => {
	const confPath = "/tmp/test/motion.conf"

	beforeEach(() => {
		process.env.storage_MOTION_CONF_FILEPATH = confPath
		const { readFileSync } = require("fs")
		readFileSync.mockImplementation((p) => (p === confPath ? "camera_dir cams\n" : ""))
	})

	test("resolves relative camera_dir against motion.conf directory", () => {
		expect(cameraConfDirSync()).toBe(path.resolve(path.dirname(confPath), "cams"))
	})
})
