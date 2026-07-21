const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

const CONFIG = path.join(__dirname, "..", "..", "pm2.config.js")

const load = (overrides) => {
	const script = `
		console.log = () => {}
		console.warn = () => {}
		const config = require(${JSON.stringify(CONFIG)})
		process.stdout.write(JSON.stringify(config))
	`
	const res = spawnSync(process.execPath, ["-e", script], {
		cwd: os.tmpdir(),
		env: { NODE_ENV: "test", command_ON: "true", ...overrides },
		encoding: "utf8"
	})
	return JSON.parse(res.stdout)
}

const appNamed = (config, name) => config.apps.find(app => app.name == name)

describe("pm2.config production logging", () => {
	test("prod routes file sinks to /dev/null and sets no log: file — the only sink is container stdout", () => {
		const app = appNamed(load({}), "command")
		expect(app.out_file).toBe("/dev/null")
		expect(app.error_file).toBe("/dev/null")
		expect(app.log).toBeUndefined()
	})
})

describe("pm2.config cluster gate", () => {
	test.each(["max", "0", "-1", "4"])("chimeraInstances=%s forces memory on and scales the service", (chimeraInstances) => {
		const config = load({ chimeraInstances, memory_ON: "false" })
		expect(appNamed(config, "memory")).toBeDefined()
		expect(appNamed(config, "command").instances).toBe(chimeraInstances)
	})

	test.each(["1", "", "lots", "-2"])("chimeraInstances=%s stays single instance with memory off", (chimeraInstances) => {
		const config = load({ chimeraInstances, memory_ON: "false" })
		expect(appNamed(config, "memory")).toBeUndefined()
		expect(appNamed(config, "command").instances).toBeUndefined()
	})

	test("memory keeps its own single instance while other services scale", () => {
		const config = load({ chimeraInstances: "4", memory_ON: "true" })
		expect(appNamed(config, "memory").instances).toBe(1)
		expect(appNamed(config, "command").instances).toBe("4")
	})
})

describe("pm2.config livestream ffmpeg apps", () => {
	let root, feed

	beforeAll(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "pm2-livestream-"))
		feed = path.join(root, "feed")
		fs.mkdirSync(path.join(root, "cameraconf"))
		fs.writeFileSync(path.join(root, "motion.conf"), "camera_dir cameraconf\n")
		fs.writeFileSync(path.join(root, "cameraconf", "cam2.conf"), "camera_id 2\ncamera_name back\nnetcam_url rtsp://cam/stream\nnetcam_userpass user:p@ss\n")
	})

	afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

	const liveConfig = () => load({
		livestream_ON: "true",
		livestream_FOLDERPATH: root,
		storage_MOTION_CONF_FILEPATH: path.join(root, "motion.conf")
	})

	test("one ffmpeg app per camera, writing its HLS playlist under livestream_FOLDERPATH", () => {
		const app = appNamed(liveConfig(), "live_stream_cam_2")
		expect(app.interpreter).toBe("none")
		expect(app.args[app.args.length - 1]).toBe(path.join(feed, "2", "video.m3u8"))
		expect(fs.existsSync(path.join(feed, "2"))).toBe(true)
	})

	test("credentials reach ffmpeg url-encoded, never as a bare netcam_userpass", () => {
		const { args } = appNamed(liveConfig(), "live_stream_cam_2")
		expect(args[args.indexOf("-i") + 1]).toBe("rtsp://user:p%40ss@cam/stream")
	})

	test("no ffmpeg apps when livestream_FOLDERPATH is unset", () => {
		const config = load({
			livestream_ON: "true",
			storage_MOTION_CONF_FILEPATH: path.join(root, "motion.conf")
		})
		expect(config.apps.filter(a => a.name.startsWith("live_stream_cam_"))).toHaveLength(0)
	})
})
