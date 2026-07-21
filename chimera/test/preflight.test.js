jest.mock("fs", () => {
	const actual = jest.requireActual("fs")
	return {
		...actual,
		existsSync: jest.fn(() => true),
		readFileSync: jest.fn((p) => {
			if (p.includes("env.example")) return [
				"SECRETKEY = Auth secret key",
				"gateway_PORT = Port number",
				"command_ON = (true | false)",
				"alert_TZ = IANA tz ***"
			].join("\n")
			if (p.includes("cam1.conf")) return "camera_id 1\ncamera_name indoor\nnetcam_url rtsp://1.1.1.1/cam\n"
			if (p.includes("cam2.conf")) return "camera_id 2\ncamera_name outdoor\nnetcam_url rtsp://2.2.2.2/cam\n"
			if (p.includes("motion.conf")) return ""
			return actual.readFileSync(p)
		}),
		readdirSync: jest.fn(() => ["cam1.conf", "cam2.conf"])
	}
})

const { parseSchema, typeOf, varProblem, cameraProblems, isServiceOff, objectFeedProblem, envProblems, hashTruncated } = require("../preflight.js")

describe("parseSchema", () => {
	test("parses required keys", () => {
		const schema = parseSchema()
		expect(schema.map(v => v.key)).toContain("SECRETKEY")
		expect(schema.map(v => v.key)).toContain("gateway_PORT")
	})

	test("marks optional keys (***)", () => {
		const schema = parseSchema()
		const tz = schema.find(v => v.key === "alert_TZ")
		expect(tz.optional).toBe(true)
	})

	test("marks required keys as not optional", () => {
		const schema = parseSchema()
		const sk = schema.find(v => v.key === "SECRETKEY")
		expect(sk.optional).toBe(false)
	})
})

describe("typeOf", () => {
	test("bool for true|false placeholder", () => {
		expect(typeOf("command_ON", "(true | false)")).toBe("bool")
	})

	test("port for _PORT suffix", () => {
		expect(typeOf("gateway_PORT", "Port number")).toBe("port")
	})

	test("port for _PORT_SECURE suffix", () => {
		expect(typeOf("gateway_PORT_SECURE", "Port number")).toBe("port")
	})

	test("string otherwise", () => {
		expect(typeOf("SECRETKEY", "Auth secret key")).toBe("string")
	})
})

describe("varProblem", () => {
	const boolVar = { key: "command_ON", placeholder: "(true | false)", optional: false }
	const portVar = { key: "gateway_PORT", placeholder: "Port number", optional: false }
	const strVar = { key: "SECRETKEY", placeholder: "Auth secret key", optional: false }
	const optVar = { key: "alert_TZ", placeholder: "IANA tz ***", optional: true }
	const instancesVar = { key: "chimeraInstances", placeholder: "Number of instances", optional: false }
	const storageHostVar = { key: "storage_HOST", placeholder: "https://storage.server.example or http://127.0.0.1:8081", optional: false }

	test("required unset → error", () => {
		expect(varProblem(strVar, undefined)).toBeTruthy()
		expect(varProblem(strVar, "")).toBeTruthy()
	})

	test("optional unset → null", () => {
		expect(varProblem(optVar, undefined)).toBeNull()
	})

	test("bool: invalid value → error", () => {
		expect(varProblem(boolVar, "yes")).toBeTruthy()
	})

	test("bool: true/false → null", () => {
		expect(varProblem(boolVar, "true")).toBeNull()
		expect(varProblem(boolVar, "false")).toBeNull()
	})

	test("port: non-numeric → error", () => {
		expect(varProblem(portVar, "abc")).toBeTruthy()
	})

	test("port: numeric string → null", () => {
		expect(varProblem(portVar, "8080")).toBeNull()
	})

	test("string: set to non-placeholder → null", () => {
		expect(varProblem(strVar, "mysecret")).toBeNull()
	})

	test("chimeraInstances: values pm2 cannot cluster → error", () => {
		expect(varProblem(instancesVar, "lots")).toBeTruthy()
		expect(varProblem(instancesVar, "-2")).toBeTruthy()
		expect(varProblem(instancesVar, "4x")).toBeTruthy()
		expect(varProblem(instancesVar, "1.5")).toBeTruthy()
	})

	test("chimeraInstances: values pm2 accepts → null", () => {
		expect(varProblem(instancesVar, "max")).toBeNull()
		expect(varProblem(instancesVar, "-1")).toBeNull()
		expect(varProblem(instancesVar, "0")).toBeNull()
		expect(varProblem(instancesVar, "1")).toBeNull()
		expect(varProblem(instancesVar, "4")).toBeNull()
	})

	test("storage_HOST: implied protocol → error, since https:// to a plain-HTTP storage fails every cron", () => {
		expect(varProblem(storageHostVar, "127.0.0.1:8081")).toBeTruthy()
		expect(varProblem(storageHostVar, "storage.server.example")).toBeTruthy()
	})

	test("storage_HOST: explicit protocol → null", () => {
		expect(varProblem(storageHostVar, "http://127.0.0.1:8081")).toBeNull()
		expect(varProblem(storageHostVar, "https://storage.server.example")).toBeNull()
	})
})

describe("objectFeedProblem", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)

	test("object without livestream blocks — the HLS feed object scans is never written", () => {
		expect(objectFeedProblem(lines({ object_ON: "true", livestream_ON: "false" }))).toMatch(/object_ON requires livestream_ON/)
	})

	test("an unset livestream_ON blocks the same way — only \"true\" starts the ffmpeg writers", () => {
		expect(objectFeedProblem(lines({ object_ON: "true" }))).toBeTruthy()
	})

	test("object with livestream passes", () => {
		expect(objectFeedProblem(lines({ object_ON: "true", livestream_ON: "true" }))).toBeNull()
	})

	test("livestream_PROXY_ON is no escape — it only routes gateway HTTP to livestream_HOST, it never fills the local livestream_FOLDERPATH", () => {
		expect(objectFeedProblem(lines({ object_ON: "true", livestream_ON: "false", livestream_PROXY_ON: "true" }))).toBeTruthy()
	})

	test("livestream without object passes — livestream stands alone", () => {
		expect(objectFeedProblem(lines({ object_ON: "false", livestream_ON: "true" }))).toBeNull()
	})

	test("both off passes", () => {
		expect(objectFeedProblem(lines({ object_ON: "false", livestream_ON: "false" }))).toBeNull()
	})
})

describe("envProblems", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)
	const SCHEMA = [{ key: "storage_FOLDERPATH", placeholder: "Base shared file path", desc: "Base shared file path", optional: false }]

	test("a blank storage_FOLDERPATH is a problem once object_ON is on, even with storage off", () => {
		expect(envProblems(SCHEMA, lines({ storage_ON: "false", object_ON: "true", livestream_ON: "true", storage_FOLDERPATH: "" })))
			.toEqual([["storage_FOLDERPATH", "required, not set"]])
	})

	test("the same blank is skipped when neither storage nor object is on", () => {
		expect(envProblems(SCHEMA, lines({ storage_ON: "false", object_ON: "false", storage_FOLDERPATH: "" }))).toHaveLength(0)
	})

	test("the object/livestream dependency rides along with the per-key problems", () => {
		const probs = envProblems(SCHEMA, lines({ storage_ON: "false", object_ON: "true", livestream_ON: "false", storage_FOLDERPATH: "" }))
		expect(probs.map(([k]) => k)).toEqual(["storage_FOLDERPATH", "object_ON"])
		expect(probs[1][1]).toMatch(/object_ON requires livestream_ON/)
	})

	test("a hand-edited value with a # is flagged even though it never went through the wizard", () => {
		const probs = envProblems(SCHEMA, lines({ storage_ON: "true", storage_FOLDERPATH: "/mnt/storage#leftover" }))
		expect(probs).toEqual([["storage_FOLDERPATH", expect.stringMatching(/cannot contain #/)]])
	})
})

describe("hashTruncated", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)

	test("flags a value that dotenv would silently truncate at #", () => {
		expect(hashTruncated(lines({ setup_TOKEN: "Str0ng#Passphrase" }), "setup_TOKEN")).toMatch(/cannot contain #/)
	})

	test("does not flag a plain value", () => {
		expect(hashTruncated(lines({ setup_TOKEN: "a-real-secret" }), "setup_TOKEN")).toBeNull()
	})

	test("does not flag a seeded key left blank with its example comment intact", () => {
		expect(hashTruncated(lines({ livestream_FOLDERPATH: "# Docker: /mnt/storage/" }), "livestream_FOLDERPATH")).toBeNull()
	})

	test("does not flag a key that is not set at all", () => {
		expect(hashTruncated(lines({}), "setup_TOKEN")).toBeNull()
	})
})

describe("cameraProblems", () => {
	test("no problems with valid confs", () => {
		expect(cameraProblems()).toHaveLength(0)
	})

	test("reports missing camera_id", () => {
		const { readFileSync } = require("fs")
		readFileSync.mockImplementation((p) => {
			if (p.includes("cam1.conf")) return "camera_name indoor\nnetcam_url rtsp://1.1.1.1/cam\n"
			if (p.includes("cam2.conf")) return "camera_id 2\ncamera_name outdoor\nnetcam_url rtsp://2.2.2.2/cam\n"
			return ""
		})
		const problems = cameraProblems()
		expect(problems.some(p => /camera_id/.test(p))).toBe(true)
	})
})

describe("isServiceOff (storage_MOTION_CONF_FILEPATH)", () => {
	const mkLines = (overrides = {}) => {
		const vals = { storage_ON: "false", object_ON: "false", livestream_ON: "false", ...overrides }
		return Object.entries(vals).map(([k, v]) => `${k} = ${v}`)
	}

	test("skipped when all camera services are off", () => {
		expect(isServiceOff(mkLines(), "storage_MOTION_CONF_FILEPATH")).toBe(true)
	})

	test("required when storage_ON=true", () => {
		expect(isServiceOff(mkLines({ storage_ON: "true" }), "storage_MOTION_CONF_FILEPATH")).toBe(false)
	})

	test("required when object_ON=true", () => {
		expect(isServiceOff(mkLines({ object_ON: "true" }), "storage_MOTION_CONF_FILEPATH")).toBe(false)
	})

	test("required when livestream_ON=true", () => {
		expect(isServiceOff(mkLines({ livestream_ON: "true" }), "storage_MOTION_CONF_FILEPATH")).toBe(false)
	})
})

describe("isServiceOff (prefix mapping)", () => {
	const lines = (o = {}) => Object.entries({ schedule_ON: "true", storage_ON: "false", object_ON: "false", livestream_ON: "false", ...o }).map(([k, v]) => `${k} = ${v}`)

	test("scheduler_AUTH follows schedule service (on)", () => {
		expect(isServiceOff(lines({ schedule_ON: "true" }), "scheduler_AUTH")).toBe(false)
	})

	test("scheduler_AUTH follows schedule service (off)", () => {
		expect(isServiceOff(lines({ schedule_ON: "false" }), "scheduler_AUTH")).toBe(true)
	})

	test("ffmpeg_FILEPATH / ffprobe_FILEPATH skipped when no camera service is on", () => {
		expect(isServiceOff(lines(), "ffmpeg_FILEPATH")).toBe(true)
		expect(isServiceOff(lines(), "ffprobe_FILEPATH")).toBe(true)
	})

	test("ffmpeg_FILEPATH required when any camera service is on", () => {
		expect(isServiceOff(lines({ storage_ON: "true" }), "ffmpeg_FILEPATH")).toBe(false)
		expect(isServiceOff(lines({ object_ON: "true" }), "ffmpeg_FILEPATH")).toBe(false)
		expect(isServiceOff(lines({ livestream_ON: "true" }), "ffmpeg_FILEPATH")).toBe(false)
	})

	test("ffprobe_FILEPATH required only when storage is on", () => {
		expect(isServiceOff(lines({ storage_ON: "true" }), "ffprobe_FILEPATH")).toBe(false)
		expect(isServiceOff(lines({ object_ON: "true" }), "ffprobe_FILEPATH")).toBe(true)
		expect(isServiceOff(lines({ livestream_ON: "true" }), "ffprobe_FILEPATH")).toBe(true)
	})

	test("storage_FOLDERPATH follows storage or object — object writes objectCaptures under it", () => {
		expect(isServiceOff(lines({ storage_ON: "false", object_ON: "false" }), "storage_FOLDERPATH")).toBe(true)
		expect(isServiceOff(lines({ storage_ON: "true" }), "storage_FOLDERPATH")).toBe(false)
		expect(isServiceOff(lines({ storage_ON: "false", object_ON: "true" }), "storage_FOLDERPATH")).toBe(false)
	})

	test("livestream_FOLDERPATH follows livestream or object — object reads its feeds out of it", () => {
		expect(isServiceOff(lines({ livestream_ON: "false", object_ON: "false" }), "livestream_FOLDERPATH")).toBe(true)
		expect(isServiceOff(lines({ livestream_ON: "true" }), "livestream_FOLDERPATH")).toBe(false)
		expect(isServiceOff(lines({ livestream_ON: "false", object_ON: "true" }), "livestream_FOLDERPATH")).toBe(false)
	})

	test("memory vars follow memory service when single-instance", () => {
		expect(isServiceOff(lines({ memory_ON: "false", chimeraInstances: "1" }), "memory_HOST")).toBe(true)
		expect(isServiceOff(lines({ memory_ON: "true", chimeraInstances: "1" }), "memory_HOST")).toBe(false)
	})

	test("memory vars required despite memory_ON=false when chimeraInstances forces cluster mode", () => {
		expect(isServiceOff(lines({ memory_ON: "false", chimeraInstances: "4" }), "memory_HOST")).toBe(false)
		expect(isServiceOff(lines({ memory_ON: "false", chimeraInstances: "max" }), "memory_AUTH_TOKEN")).toBe(false)
		expect(isServiceOff(lines({ memory_ON: "false", chimeraInstances: "0" }), "memory_PORT")).toBe(false)
		expect(isServiceOff(lines({ memory_ON: "false", chimeraInstances: "-1" }), "memory_PORT")).toBe(false)
	})

	test("storage_HOST required despite storage_ON=false when schedule is on — crons post to it directly", () => {
		expect(isServiceOff(lines({ storage_ON: "false", schedule_ON: "true" }), "storage_HOST")).toBe(false)
		expect(isServiceOff(lines({ storage_ON: "true", schedule_ON: "false" }), "storage_HOST")).toBe(false)
		expect(isServiceOff(lines({ storage_ON: "false", schedule_ON: "false" }), "storage_HOST")).toBe(true)
	})

	test.each(["storage", "schedule", "livestream", "object", "command"])("%s_HOST required despite %s_ON=false when the gateway proxies it — it is the proxy target", (prefix) => {
		const off = { schedule_ON: "false", [`${prefix}_ON`]: "false" }
		expect(isServiceOff(lines({ ...off, [`${prefix}_PROXY_ON`]: "true" }), `${prefix}_HOST`)).toBe(false)
		expect(isServiceOff(lines({ ...off, [`${prefix}_PROXY_ON`]: "false" }), `${prefix}_HOST`)).toBe(true)
	})

	test("a PROXY_ON service still skips its non-host vars — only the proxy target is needed", () => {
		expect(isServiceOff(lines({ storage_ON: "false", schedule_ON: "false", storage_PROXY_ON: "true" }), "storage_PORT")).toBe(true)
		expect(isServiceOff(lines({ storage_ON: "false", schedule_ON: "false", storage_PROXY_ON: "true" }), "storage_FOLDERPATH")).toBe(true)
	})

	test("scheduler_TRUSTED_SOURCES is never service-gated — lib compiles it at import in every service", () => {
		expect(isServiceOff(lines({ schedule_ON: "false" }), "scheduler_TRUSTED_SOURCES")).toBe(false)
		expect(isServiceOff(lines({ schedule_ON: "true" }), "scheduler_TRUSTED_SOURCES")).toBe(false)
		expect(isServiceOff(lines({ schedule_ON: "false" }), "scheduler_AUTH")).toBe(true)
	})
})
