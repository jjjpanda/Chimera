const mockState = { files: {}, dirs: [], answers: [] }

jest.mock("fs", () => {
	const norm = (p) => String(p).replace(/\\/g, "/")
	const find = (p) => Object.keys(mockState.files).find(k => norm(p).endsWith(k))
	return {
		existsSync: jest.fn((p) => find(p) !== undefined || mockState.dirs.some(d => norm(p).endsWith(d))),
		readFileSync: jest.fn((p) => {
			const k = find(p)
			if (k === undefined) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" })
			return mockState.files[k]
		}),
		writeFileSync: jest.fn((p, data) => { mockState.files[find(p) ?? norm(p).split("/").pop()] = data }),
		copyFileSync: jest.fn((from, to) => { mockState.files[norm(to).split("/").pop()] = mockState.files[find(from)] }),
		readdirSync: jest.fn(() => Object.keys(mockState.files).filter(k => k.startsWith("cameraconf/")).map(k => k.slice("cameraconf/".length))),
		mkdirSync: jest.fn()
	}
})

jest.mock("readline", () => ({
	createInterface: () => ({
		question: (q, cb) => {
			if (!mockState.answers.length) throw new Error(`preflight asked for more input than the test scripted: ${q.trim()}`)
			cb(mockState.answers.shift())
		},
		close: jest.fn()
	})
}))

const EXAMPLE = [
	"storage_ON = (true | false)",
	"storage_FOLDERPATH = Base shared file path",
	"livestream_ON = (true | false)",
	"livestream_FOLDERPATH = Base shared folder path",
	"livestream_PROXY_ON = (true | false)",
	"object_ON = (true | false)",
	"SECRETKEY = Auth secret key"
].join("\n")

const CAM = "camera_id 1\ncamera_name indoor\nnetcam_url rtsp://1.1.1.1/cam\n"

const envText = (env) => Object.entries(env).map(([k, v]) => `${k} = ${v}`).join("\n")

const setup = ({ env, answers, noEnv = false }) => {
	mockState.files = {
		"env.example": EXAMPLE,
		"motion.conf": "",
		"motion.conf.example": "",
		"cameraconf/cam1.conf": CAM,
		...(noEnv ? {} : { ".env": envText(env) })
	}
	mockState.dirs = ["cameraconf"]
	mockState.answers = [...answers]
}

const BLANK = { storage_ON: "", storage_FOLDERPATH: "", livestream_ON: "", livestream_FOLDERPATH: "", livestream_PROXY_ON: "", object_ON: "", SECRETKEY: "" }

const load = () => {
	let mod
	jest.isolateModules(() => { mod = require("../preflight.js") })
	return mod
}

const EXITED = Symbol("process.exit")

const run = async () => {
	const out = []
	const log = jest.spyOn(console, "log").mockImplementation((...a) => out.push(a.join(" ")))
	const exit = jest.spyOn(process, "exit").mockImplementation((code) => { throw Object.assign(new Error(EXITED.toString()), { code, [EXITED]: true }) })
	let exitCode = 0
	try {
		await load().runInteractive()
	} catch (e) {
		if (!e[EXITED]) throw e
		exitCode = e.code
	} finally {
		log.mockRestore()
		exit.mockRestore()
	}
	expect(mockState.answers).toHaveLength(0)
	return { out: out.join("\n"), exitCode, env: mockState.files[".env"] ?? "" }
}

describe("runInteractive re-walk", () => {
	test("answering object_ON=true unskips storage_FOLDERPATH and livestream_FOLDERPATH, which the first pass already walked past", async () => {
		setup({
			env: BLANK,
			// storage_ON, livestream_ON, livestream_FOLDERPATH, livestream_PROXY_ON, object_ON, SECRETKEY, then the second-pass storage_FOLDERPATH
			answers: ["false", "true", "/mnt/live", "false", "true", "a-real-secret", "/mnt/storage"]
		})
		const { out, exitCode, env } = await run()
		expect(env).toContain("storage_FOLDERPATH = /mnt/storage")
		expect(env).toContain("livestream_FOLDERPATH = /mnt/live")
		expect(out).toContain("All checks passed")
		expect(exitCode).toBe(0)
	})

	test("storage_FOLDERPATH stays skipped when neither storage nor object is turned on", async () => {
		setup({
			// livestream off also skips livestream_FOLDERPATH and livestream_PROXY_ON
			env: BLANK,
			answers: ["false", "false", "false", "a-real-secret"]
		})
		const { env, exitCode } = await run()
		expect(env).toContain("storage_FOLDERPATH = \n")
		expect(exitCode).toBe(0)
	})

	test("re-prompts until the answer validates instead of writing a bad value", async () => {
		setup({
			env: BLANK,
			answers: ["", "yes", "false", "false", "false", "a-real-secret"]
		})
		const { env, exitCode } = await run()
		expect(env).toContain("storage_ON = false")
		expect(exitCode).toBe(0)
	})

	test("rejects a # in the answer instead of re-walking forever — dotenv drops everything after it, so the value would never read back", async () => {
		setup({
			env: BLANK,
			answers: ["false", "false", "false", "#Hunter2", "Hunter2"]
		})
		const { out, env, exitCode } = await run()
		expect(out).toContain("cannot contain #")
		expect(env).toContain("SECRETKEY = Hunter2")
		expect(exitCode).toBe(0)
	})

	test("seeds .env from env.example when it is missing", async () => {
		setup({
			env: {},
			noEnv: true,
			answers: ["false", "false", "false", "a-real-secret"]
		})
		const { env, exitCode } = await run()
		expect(env).toContain("SECRETKEY = a-real-secret")
		expect(exitCode).toBe(0)
	})
})

describe("runInteractive final gate", () => {
	test("objectFeedProblem blocks the run — it cannot be answered away, so it is reported after the walk", async () => {
		setup({
			env: { ...BLANK, storage_ON: "false", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", livestream_FOLDERPATH: "/mnt/live", livestream_PROXY_ON: "false", object_ON: "true", SECRETKEY: "a-real-secret" },
			answers: []
		})
		const { out, exitCode } = await run()
		expect(out).toContain("object_ON requires livestream_ON")
		expect(out).toContain("Still incomplete")
		expect(exitCode).toBe(1)
	})

	test("livestream_PROXY_ON=true clears that gate — livestream runs on another node", async () => {
		setup({
			env: { ...BLANK, storage_ON: "false", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", livestream_FOLDERPATH: "/mnt/live", livestream_PROXY_ON: "true", object_ON: "true", SECRETKEY: "a-real-secret" },
			answers: []
		})
		const { out, exitCode } = await run()
		expect(out).not.toContain("object_ON requires livestream_ON")
		expect(out).toContain("All checks passed")
		expect(exitCode).toBe(0)
	})
})
