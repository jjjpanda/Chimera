const mockState = { files: {}, dirs: [], answers: [], modes: {}, chmodFail: new Set(), close: null }
const mockEOF = Symbol("EOF")

jest.mock("fs", () => {
	const norm = (p) => String(p).replace(/\\/g, "/")
	const find = (p) => Object.keys(mockState.files).find(k => norm(p).endsWith(k))
	const key = (p) => find(p) ?? norm(p).split("/").slice(norm(p).includes("/cameraconf/") ? -2 : -1).join("/")
	return {
		existsSync: jest.fn((p) => find(p) !== undefined || mockState.dirs.some(d => norm(p).endsWith(d))),
		readFileSync: jest.fn((p) => {
			const k = find(p)
			if (k === undefined) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" })
			return mockState.files[k]
		}),
		writeFileSync: jest.fn((p, data, opts) => {
			const k = key(p)
			mockState.files[k] = data
			if (opts?.mode !== undefined) mockState.modes[k] = opts.mode
		}),
		unlinkSync: jest.fn((p) => {
			const k = key(p)
			delete mockState.files[k]
			delete mockState.modes[k]
		}),
		chmodSync: jest.fn((p, mode) => {
			const k = key(p)
			if (mockState.chmodFail.has(k)) throw Object.assign(new Error("EPERM"), { code: "EPERM" })
			mockState.modes[k] = mode
		}),
		statSync: jest.fn((p) => {
			const k = find(p)
			const isDir = k === undefined && mockState.dirs.some(d => norm(p).endsWith(d))
			if (k === undefined && !isDir) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" })
			return { mode: mockState.modes[k] ?? 0o644, isFile: () => !isDir, isDirectory: () => isDir }
		}),
		copyFileSync: jest.fn((from, to) => { mockState.files[norm(to).split("/").pop()] = mockState.files[find(from)] }),
		readdirSync: jest.fn(() => Object.keys(mockState.files).filter(k => k.startsWith("cameraconf/")).map(k => k.slice("cameraconf/".length))),
		mkdirSync: jest.fn()
	}
})

jest.mock("readline", () => ({
	createInterface: () => ({
		on: (event, cb) => { if (event === "close") mockState.close = cb },
		question: (q, cb) => {
			if (!mockState.answers.length) throw new Error(`preflight asked for more input than the test scripted: ${q.trim()}`)
			const answer = mockState.answers.shift()
			// on EOF real readline emits close and never calls the question callback
			if (answer === mockEOF) return mockState.close?.()
			cb(answer)
		},
		close: () => mockState.close?.()
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

const setup = ({ env, answers, noEnv = false, noCams = false, motionDir = false, example = EXAMPLE }) => {
	mockState.files = {
		"env.example": example,
		...(motionDir ? {} : { "motion.conf": "" }),
		"motion.conf.example": "",
		...(noCams ? {} : { "cameraconf/cam1.conf": CAM }),
		...(noEnv ? {} : { ".env": envText(env) })
	}
	mockState.dirs = motionDir ? ["cameraconf", "motion.conf"] : ["cameraconf"]
	mockState.answers = [...answers]
	mockState.modes = {}
	mockState.chmodFail = new Set()
	mockState.close = null
}

const BLANK = { storage_ON: "", storage_FOLDERPATH: "", livestream_ON: "", livestream_FOLDERPATH: "", livestream_PROXY_ON: "", object_ON: "", SECRETKEY: "" }
const SECRET = "a-real-secret-padded-to-32-chars!"

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
	return { out: out.join("\n"), exitCode, env: mockState.files[".env"] ?? "", modes: mockState.modes }
}

describe("runInteractive re-walk", () => {
	test("answering object_ON=true unskips storage_FOLDERPATH and livestream_FOLDERPATH, which the first pass already walked past", async () => {
		setup({
			env: BLANK,
			// storage_ON, livestream_ON, livestream_FOLDERPATH, livestream_PROXY_ON, object_ON, SECRETKEY, then the second-pass storage_FOLDERPATH
			answers: ["false", "true", "/mnt/live", "false", "true", SECRET, "/mnt/storage"]
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
			answers: ["false", "false", "false", SECRET]
		})
		const { env, exitCode } = await run()
		expect(env).toContain("storage_FOLDERPATH = \n")
		expect(exitCode).toBe(0)
	})

	test("re-prompts until the answer validates instead of writing a bad value", async () => {
		setup({
			env: BLANK,
			answers: ["", "yes", "false", "false", "false", SECRET]
		})
		const { env, exitCode } = await run()
		expect(env).toContain("storage_ON = false")
		expect(exitCode).toBe(0)
	})

	test("rejects a # in the answer instead of re-walking forever — dotenv drops everything after it, so the value would never read back", async () => {
		setup({
			env: BLANK,
			answers: ["false", "false", "false", "#Hunter2", SECRET]
		})
		const { out, env, exitCode } = await run()
		expect(out).toContain("cannot contain #")
		expect(env).toContain(`SECRETKEY = ${SECRET}`)
		expect(exitCode).toBe(0)
	})

	test("re-asks a pre-existing hand-edited value that already has a # — its truncated remainder looked valid, so nothing would otherwise catch it", async () => {
		setup({
			env: { ...BLANK, SECRETKEY: `${SECRET}#leftover` },
			answers: ["false", "false", "false", SECRET]
		})
		const { out, env, exitCode } = await run()
		expect(out).toContain("cannot contain #")
		expect(env).toContain(`SECRETKEY = ${SECRET}`)
		expect(out).toContain("All checks passed")
		expect(exitCode).toBe(0)
	})

	test("blank SECRETKEY answer fills in the generated default instead of leaving it blank", async () => {
		setup({
			env: BLANK,
			answers: ["false", "false", "false", ""]
		})
		const { env, exitCode } = await run()
		expect(env).toMatch(/SECRETKEY = [A-Za-z0-9_-]{32,}/)
		expect(exitCode).toBe(0)
	})

	test("seeds .env from env.example when it is missing", async () => {
		setup({
			env: {},
			noEnv: true,
			answers: ["false", "false", "false", SECRET]
		})
		const { env, exitCode } = await run()
		expect(env).toContain(`SECRETKEY = ${SECRET}`)
		expect(exitCode).toBe(0)
	})

	test("seeding keeps a # default value verbatim, and the walk never asks for it", async () => {
		setup({
			env: {},
			noEnv: true,
			example: EXAMPLE.replace("storage_FOLDERPATH = Base shared file path", "storage_FOLDERPATH = /mnt/storage/  # default; base shared file path"),
			// storage_ON, livestream_ON, object_ON, SECRETKEY — no prompt for storage_FOLDERPATH
			answers: ["true", "false", "false", SECRET]
		})
		const { env, exitCode } = await run()
		expect(env).toContain("storage_FOLDERPATH = /mnt/storage/  # default; base shared file path")
		expect(exitCode).toBe(0)
	})
})

describe("runInteractive secret file modes", () => {
	// 0640 keeps .env off world-read while still letting the container's uid 1000 read it through group 1000
	test("a seeded .env lands at 0640, not the umask default", async () => {
		setup({ env: {}, noEnv: true, answers: ["false", "false", "false", SECRET] })
		const { modes, exitCode } = await run()
		expect(modes[".env"]).toBe(0o640)
		expect(exitCode).toBe(0)
	})

	// preflight is unprivileged, so it cannot chgrp — the printed command is the only thing that makes 0640 readable to the container
	const withGid = async (gid) => {
		const had = Object.prototype.hasOwnProperty.call(process, "getgid")
		const original = process.getgid
		if (gid === undefined) delete process.getgid
		else process.getgid = () => gid
		try { return await run() }
		finally { if (had) process.getgid = original; else delete process.getgid }
	}

	test("tells the user to chgrp when their gid is not 1000", async () => {
		setup({ env: {}, noEnv: true, answers: ["false", "false", "false", SECRET] })
		const { out } = await withGid(1001)
		expect(out).toContain("sudo chown \"$USER\":1000 .env")
	})

	test("says nothing when the gid already is 1000, or when the host has no gids at all", async () => {
		setup({ env: {}, noEnv: true, answers: ["false", "false", "false", SECRET] })
		expect((await withGid(1000)).out).not.toContain("sudo chown")
		setup({ env: {}, noEnv: true, answers: ["false", "false", "false", SECRET] })
		expect((await withGid(undefined)).out).not.toContain("sudo chown")
	})

	// `cp env.example .env` by hand, or any run predating 0640, leaves a 0644 .env that seedEnv never revisits
	test("an existing .env is tightened to 0640, and still earns the chgrp hint", async () => {
		setup({ env: BLANK, answers: ["false", "false", "false", SECRET] })
		const { modes, out, exitCode } = await withGid(1001)
		expect(modes[".env"]).toBe(0o640)
		expect(out).toContain("sudo chown \"$USER\":1000 .env")
		expect(exitCode).toBe(0)
	})

	// `cp cameraconf/camera.conf.example cameraconf/cam1.conf` leaves 0644, and a valid conf is never rewritten
	test("an existing camera conf is tightened to 0640 even when the wizard adds nothing", async () => {
		setup({
			env: { ...BLANK, storage_ON: "true", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", object_ON: "false", SECRETKEY: SECRET },
			answers: []
		})
		const { modes, exitCode } = await run()
		expect(modes["cameraconf/cam1.conf"]).toBe(0o640)
		expect(exitCode).toBe(0)
	})

	// preflight is unprivileged — when chmod itself fails, the conf stays loose and must be reported, not trusted
	test("an existing camera conf that resists chmod stays loose and is reported", async () => {
		setup({
			env: { ...BLANK, storage_ON: "true", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", object_ON: "false", SECRETKEY: SECRET },
			answers: []
		})
		mockState.chmodFail.add("cameraconf/cam1.conf")
		const { out, exitCode } = await run()
		expect(out).toContain("cam1.conf mode 0644")
		expect(out).toContain("Still incomplete")
		expect(exitCode).toBe(1)
	})

	test("a camera conf lands at 0640 — it carries netcam_userpass", async () => {
		setup({
			env: { ...BLANK, storage_ON: "true", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", object_ON: "false", SECRETKEY: SECRET },
			noCams: true,
			answers: ["y", "2", "back", "rtsp://1.1.1.1/cam", "user:pass", "n"]
		})
		const { modes, exitCode } = await run()
		expect(modes["cameraconf/cam2.conf"]).toBe(0o640)
		expect(exitCode).toBe(0)
	})
})

describe("runInteractive objectFeedProblem", () => {
	// every key holds a valid value, so the schema walk asks nothing at all
	const BROKEN = { ...BLANK, storage_ON: "false", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", livestream_FOLDERPATH: "/mnt/live", livestream_PROXY_ON: "false", object_ON: "true", SECRETKEY: SECRET }

	test("prompts livestream_ON instead of dead-ending — nothing has a varProblem, so only the forced re-ask can fix it", async () => {
		setup({ env: BROKEN, answers: ["true"] })
		const { out, env, exitCode } = await run()
		expect(out).toContain("object_ON requires livestream_ON")
		expect(env).toContain("livestream_ON = true")
		expect(out).toContain("All checks passed")
		expect(exitCode).toBe(0)
	})

	test("falls through to object_ON when livestream stays off — turning object off resolves it too", async () => {
		setup({ env: BROKEN, answers: ["false", "false"] })
		const { env, exitCode } = await run()
		expect(env).toContain("object_ON = false")
		expect(exitCode).toBe(0)
	})

	test("re-asks while the pair stays inconsistent", async () => {
		setup({ env: BROKEN, answers: ["false", "true", "true"] })
		const { env, exitCode } = await run()
		expect(env).toContain("livestream_ON = true")
		expect(env).toContain("object_ON = true")
		expect(exitCode).toBe(0)
	})

	test("livestream_PROXY_ON=true is no escape — it only routes gateway HTTP, so the wizard still prompts", async () => {
		setup({ env: { ...BROKEN, livestream_PROXY_ON: "true" }, answers: ["true"] })
		const { out, exitCode } = await run()
		expect(out).toContain("object_ON requires livestream_ON")
		expect(exitCode).toBe(0)
	})
})

describe("runInteractive cookieSecureProblem", () => {
	const EXAMPLE_WITH_GATEWAY = `${EXAMPLE}\ngateway_HOST = Gateway host\ncommand_COOKIE_SECURE = (true | false)`
	// every key holds a valid value except the insecure-cookie pair, so only the forced re-ask can fix it
	const COOKIE_BROKEN = { ...BLANK, storage_ON: "false", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", livestream_FOLDERPATH: "/mnt/live", livestream_PROXY_ON: "false", object_ON: "false", SECRETKEY: SECRET, gateway_HOST: "https://example.com", command_COOKIE_SECURE: "false" }

	test("prompts gateway_HOST instead of dead-ending — nothing has a varProblem, so only the forced re-ask can fix it", async () => {
		setup({ env: COOKIE_BROKEN, answers: ["127.0.0.1"], example: EXAMPLE_WITH_GATEWAY })
		const { out, env, exitCode } = await run()
		expect(out).toContain("command_COOKIE_SECURE MUST BE true")
		expect(env).toContain("gateway_HOST = 127.0.0.1")
		expect(out).toContain("All checks passed")
		expect(exitCode).toBe(0)
	})

	test("falls through to command_COOKIE_SECURE when gateway_HOST stays public — setting the cookie flag resolves it too", async () => {
		setup({ env: COOKIE_BROKEN, answers: ["https://example.com", "true"], example: EXAMPLE_WITH_GATEWAY })
		const { env, exitCode } = await run()
		expect(env).toContain("command_COOKIE_SECURE = true")
		expect(exitCode).toBe(0)
	})
})

describe("runInteractive cookiePlainHttpProblem", () => {
	const EXAMPLE_WITH_GATEWAY = `${EXAMPLE}\ngateway_HOST = Gateway host\ncommand_COOKIE_SECURE = (true | false)`
	// every key holds a valid value except the plain-http cookie pair, so only the forced re-ask can fix it
	const PLAIN_HTTP_BROKEN = { ...BLANK, storage_ON: "false", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", livestream_FOLDERPATH: "/mnt/live", livestream_PROXY_ON: "false", object_ON: "false", SECRETKEY: SECRET, gateway_HOST: "http://192.168.1.50:8080", command_COOKIE_SECURE: "true" }

	test("prompts gateway_HOST instead of dead-ending — nothing has a varProblem, so only the forced re-ask can fix it", async () => {
		setup({ env: PLAIN_HTTP_BROKEN, answers: ["127.0.0.1"], example: EXAMPLE_WITH_GATEWAY })
		const { out, env, exitCode } = await run()
		expect(out).toContain("command_COOKIE_SECURE MUST BE false")
		expect(env).toContain("gateway_HOST = 127.0.0.1")
		expect(out).toContain("All checks passed")
		expect(exitCode).toBe(0)
	})

	test("falls through to command_COOKIE_SECURE when gateway_HOST stays explicit http:// — clearing the cookie flag resolves it too", async () => {
		setup({ env: PLAIN_HTTP_BROKEN, answers: ["http://192.168.1.50:8080", "false"], example: EXAMPLE_WITH_GATEWAY })
		const { env, exitCode } = await run()
		expect(env).toContain("command_COOKIE_SECURE = false")
		expect(exitCode).toBe(0)
	})
})

describe("runInteractive motion.conf directory", () => {
	test("reports the directory instead of asking to copy over it — copyFileSync would only throw EISDIR", async () => {
		setup({
			env: { ...BLANK, storage_ON: "true", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", object_ON: "false", SECRETKEY: SECRET },
			motionDir: true,
			answers: []
		})
		const { out, exitCode } = await run()
		expect(out).toContain("is a directory")
		expect(out).toContain("Still incomplete")
		expect(exitCode).toBe(1)
	})
})

describe("runInteractive certbotPortProblem", () => {
	const EXAMPLE_WITH_CERTBOT = `${EXAMPLE}\ncertbot_ON = (true | false)\ngateway_PORT = Port number`
	// every key holds a valid value, so only the forced re-ask can fix the pair
	const CERTBOT_BROKEN = { ...BLANK, storage_ON: "false", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", livestream_FOLDERPATH: "/mnt/live", livestream_PROXY_ON: "false", object_ON: "false", SECRETKEY: SECRET, certbot_ON: "true", gateway_PORT: "8080" }

	test("prompts certbot_ON instead of dead-ending — turning certbot off resolves it", async () => {
		setup({ env: CERTBOT_BROKEN, answers: ["false"], example: EXAMPLE_WITH_CERTBOT })
		const { out, env, exitCode } = await run()
		expect(out).toContain("gateway_PORT MUST BE 80")
		expect(env).toContain("certbot_ON = false")
		expect(out).toContain("All checks passed")
		expect(exitCode).toBe(0)
	})

	test("falls through to gateway_PORT when certbot stays on — port 80 resolves it too", async () => {
		setup({ env: CERTBOT_BROKEN, answers: ["true", "80"], example: EXAMPLE_WITH_CERTBOT })
		const { env, exitCode } = await run()
		expect(env).toContain("gateway_PORT = 80")
		expect(exitCode).toBe(0)
	})
})

describe("runInteractive abort", () => {
	// EOF used to leave the promise unsettled: the walk stalled, nothing was written, and node exited 0
	test("Ctrl-D reports the abort and exits 1 instead of passing silently", async () => {
		setup({ env: BLANK, answers: ["false", mockEOF] })
		const { out, exitCode } = await run()
		expect(out).toContain("Aborted")
		expect(out).not.toContain("All checks passed")
		expect(exitCode).toBe(1)
	})

	test("answers given before the abort are not half-written to .env", async () => {
		setup({ env: BLANK, answers: ["false", mockEOF] })
		const { env, out } = await run()
		expect(env).not.toContain("storage_ON = false")
		expect(env).toBe(envText(BLANK))
		expect(out).toContain("no changes written")
	})

	// the .env write at :382 and seedEnv both precede later prompts, so "no changes written" would be a lie there
	test("EOF at a camera prompt keeps the written .env and says so", async () => {
		setup({
			env: { ...BLANK, storage_ON: "true", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", object_ON: "false" },
			answers: [SECRET, mockEOF],
			noCams: true
		})
		const { out, env, exitCode } = await run()
		expect(exitCode).toBe(1)
		expect(env).toContain(`SECRETKEY = ${SECRET}`)
		expect(out).toContain("changes already written are kept")
		expect(out).not.toContain("no changes written")
	})

	test("EOF at the first prompt of a seeded run reports the seeded file rather than a clean slate", async () => {
		setup({ env: BLANK, answers: [mockEOF], noEnv: true })
		const { out, exitCode } = await run()
		expect(exitCode).toBe(1)
		expect(mockState.files[".env"]).toBeDefined()
		expect(out).toContain("changes already written are kept")
	})
})

const runCheckOnce = () => {
	const out = []
	const log = jest.spyOn(console, "log").mockImplementation((...a) => out.push(a.join(" ")))
	const exit = jest.spyOn(process, "exit").mockImplementation((code) => { throw Object.assign(new Error(EXITED.toString()), { code, [EXITED]: true }) })
	let exitCode = 0
	try {
		load().runCheck()
	} catch (e) {
		if (!e[EXITED]) throw e
		exitCode = e.code
	} finally {
		log.mockRestore()
		exit.mockRestore()
	}
	return { out: out.join("\n"), exitCode }
}

describe("runCheck", () => {
	// `--check` never prompts or writes — it only reports what's already on disk
	test("passes when .env and cameraconf/ are already complete and tight", () => {
		setup({
			env: { ...BLANK, storage_ON: "true", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", object_ON: "false", SECRETKEY: SECRET },
			answers: []
		})
		mockState.modes[".env"] = 0o640
		mockState.modes["cameraconf/cam1.conf"] = 0o640
		const { out, exitCode } = runCheckOnce()
		expect(out).toContain("All checks passed")
		expect(exitCode).toBe(0)
	})

	test("reports a missing .env and exits 1", () => {
		setup({ env: {}, noEnv: true, answers: [] })
		const { out, exitCode } = runCheckOnce()
		expect(out).toContain(".env")
		expect(out).toContain("missing")
		expect(exitCode).toBe(1)
	})

	test("flags a loose .env mode", () => {
		setup({
			env: { ...BLANK, storage_ON: "false", livestream_ON: "false", object_ON: "false", SECRETKEY: SECRET },
			answers: []
		})
		mockState.modes[".env"] = 0o644
		const { out, exitCode } = runCheckOnce()
		expect(out).toContain(".env: mode 0644")
		expect(exitCode).toBe(1)
	})

	// bringing the stack up with storage off makes Docker create a directory at the bind-mount path
	test("a motion.conf directory fails and names the fix — existsSync alone reported it present", () => {
		setup({
			env: { ...BLANK, storage_ON: "true", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", object_ON: "false", SECRETKEY: SECRET },
			motionDir: true,
			answers: []
		})
		mockState.modes[".env"] = 0o640
		mockState.modes["cameraconf/cam1.conf"] = 0o640
		const { out, exitCode } = runCheckOnce()
		expect(out).toContain("is a directory")
		expect(out).toContain("rm -rf motion.conf")
		expect(exitCode).toBe(1)
	})

	test("flags a loose camera conf mode", () => {
		setup({
			env: { ...BLANK, storage_ON: "true", storage_FOLDERPATH: "/mnt/storage", livestream_ON: "false", object_ON: "false", SECRETKEY: SECRET },
			answers: []
		})
		mockState.modes[".env"] = 0o640
		mockState.modes["cameraconf/cam1.conf"] = 0o644
		const { out, exitCode } = runCheckOnce()
		expect(out).toContain("cam1.conf mode 0644")
		expect(exitCode).toBe(1)
	})
})
