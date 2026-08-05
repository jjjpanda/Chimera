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
				"alert_TZ = IANA tz ***",
				"storage_FOLDERPATH = /mnt/storage/  # default; base shared file path",
				"livestream_FOLDERPATH = Base shared folder path  # frames live here"
			].join("\n")
			if (p.includes("cam1.conf")) return "camera_id 1\ncamera_name indoor\nnetcam_url rtsp://1.1.1.1/cam\n"
			if (p.includes("cam2.conf")) return "camera_id 2\ncamera_name outdoor\nnetcam_url rtsp://2.2.2.2/cam\n"
			if (p.includes("motion.conf")) return ""
			return actual.readFileSync(p)
		}),
		readdirSync: jest.fn(() => ["cam1.conf", "cam2.conf"])
	}
})

const { parseSchema, typeOf, varProblem, cameraProblems, isServiceOff, blankDisables, objectFeedProblem, insecureCookie, cookieSecureProblem, cookiePlainHttpProblem, cookieAmbiguousHostWarning, certbotPortProblem, duplicatePortProblems, setupTokenHint, envProblems, hashTruncated, looseMode } = require("../preflight.js")

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

	test("keeps a trailing # hint in desc but strips it from placeholder", () => {
		const schema = parseSchema()
		const fp = schema.find(v => v.key === "livestream_FOLDERPATH")
		expect(fp.placeholder).toBe("Base shared folder path")
		expect(fp.desc).toContain("# frames live here")
	})

	test("a # default line holds a real value, so nothing is treated as placeholder prose", () => {
		const schema = parseSchema()
		const fp = schema.find(v => v.key === "storage_FOLDERPATH")
		expect(fp.placeholder).toBe("")
		expect(varProblem(fp, "/mnt/storage/")).toBeNull()
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
	const strVar = { key: "database_NAME", placeholder: "postgres database name", optional: false }
	const secretVar = { key: "SECRETKEY", placeholder: "Auth secret key", optional: false }
	const optVar = { key: "alert_TZ", placeholder: "IANA tz ***", optional: true }
	const instancesVar = { key: "chimeraInstances", placeholder: "Number of instances", optional: false }
	const storageHostVar = { key: "storage_HOST", placeholder: "https://storage.server.example or http://127.0.0.1:8081", optional: false }
	const alertOnVar = { key: "object_ALERT_ON", placeholder: "(true | text | false, default true)", optional: true }
	const tokenVar = { key: "setup_TOKEN", placeholder: "required token gating /authorization/setup", optional: false }
	const schedulerAuthVar = { key: "scheduler_AUTH", placeholder: "Authorization token for scheduler server", optional: false }
	const memoryTokenVar = { key: "memory_AUTH_TOKEN", placeholder: "Header token to connect to memory socket", optional: false }
	const dbPasswordVar = { key: "database_PASSWORD", placeholder: "postgres password", optional: false }

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

	test("object_ALERT_ON: text is a valid third value, anything else is not", () => {
		expect(varProblem(alertOnVar, "text")).toBeNull()
		expect(varProblem(alertOnVar, "true")).toBeNull()
		expect(varProblem(alertOnVar, "false")).toBeNull()
		expect(varProblem(alertOnVar, "yes")).toBeTruthy()
	})

	test("port: non-numeric → error", () => {
		expect(varProblem(portVar, "abc")).toBeTruthy()
	})

	test("port: numeric string → null", () => {
		expect(varProblem(portVar, "8080")).toBeNull()
	})

	test("port: out of range → error, so it cannot reach listen() and throw ERR_SOCKET_BAD_PORT", () => {
		expect(varProblem(portVar, "0")).toBeTruthy()
		expect(varProblem(portVar, "65536")).toBeTruthy()
		expect(varProblem(portVar, "99999")).toBeTruthy()
		expect(varProblem(portVar, "1")).toBeNull()
		expect(varProblem(portVar, "65535")).toBeNull()
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

	test("setup_TOKEN: under 32 characters → error, so preflight blocks what validateEnvVars would crash-loop on", () => {
		expect(varProblem(tokenVar, "too-short-a-token")).toBeTruthy()
	})

	test("setup_TOKEN: at least 32 characters → null", () => {
		expect(varProblem(tokenVar, "a".repeat(32))).toBeNull()
	})

	test("SECRETKEY: under 32 characters → error, matching the boot check instead of crash-looping there", () => {
		expect(varProblem(secretVar, "short-signing-key")).toBeTruthy()
	})

	test("SECRETKEY: at least 32 characters → null", () => {
		expect(varProblem(secretVar, "a".repeat(32))).toBeNull()
	})

	test("scheduler_AUTH: under 32 characters → error, since a match grants role admin on the schedulable routes", () => {
		expect(varProblem(schedulerAuthVar, "short-scheduler-auth")).toBeTruthy()
		expect(varProblem(schedulerAuthVar, "a".repeat(32))).toBeNull()
	})

	test("the length floor covers every key isSecret matches, not just SECRETKEY and setup_TOKEN", () => {
		expect(varProblem(memoryTokenVar, "short-memory-token")).toBeTruthy()
		expect(varProblem(dbPasswordVar, "postgres")).toBeTruthy()
		expect(varProblem(memoryTokenVar, "a".repeat(32))).toBeNull()
		expect(varProblem(dbPasswordVar, "a".repeat(32))).toBeNull()
	})

	test("a short non-secret is untouched by the floor", () => {
		expect(varProblem(strVar, "chimera")).toBeNull()
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

describe("cookieSecureProblem", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)

	test("a scheme-less public gateway_HOST resolves to https, so an insecure cookie is fatal", () => {
		expect(cookieSecureProblem(lines({ gateway_HOST: "example.com", command_COOKIE_SECURE: "false" }))).toMatch(/command_COOKIE_SECURE MUST BE true/)
	})

	test("gateway_HTTPS_Redirect makes it fatal even on a plain-http gateway_HOST", () => {
		expect(cookieSecureProblem(lines({ gateway_HOST: "http://example.com", command_COOKIE_SECURE: "false", gateway_HTTPS_Redirect: "true" }))).toBeTruthy()
	})

	test("certbot_ON makes it fatal even on a plain-http gateway_HOST", () => {
		expect(cookieSecureProblem(lines({ gateway_HOST: "http://example.com", command_COOKIE_SECURE: "false", certbot_ON: "true" }))).toBeTruthy()
	})

	test("a plain-http gateway_HOST with no HTTPS signal warns instead of failing", () => {
		const l = lines({ gateway_HOST: "http://example.com", command_COOKIE_SECURE: "false" })
		expect(cookieSecureProblem(l)).toBeNull()
		expect(insecureCookie(l)).toBe(true)
	})

	test("loopback passes", () => {
		expect(insecureCookie(lines({ gateway_HOST: "127.0.0.1", command_COOKIE_SECURE: "false" }))).toBe(false)
	})

	test("a set cookie flag passes", () => {
		expect(insecureCookie(lines({ gateway_HOST: "example.com", command_COOKIE_SECURE: "true" }))).toBe(false)
	})

	test("the check is skipped when the command service is off", () => {
		expect(insecureCookie(lines({ gateway_HOST: "example.com", command_ON: "false", command_COOKIE_SECURE: "false" }))).toBe(false)
	})

	test("command_COOKIE_SECURE=true on an explicit http:// gateway_HOST never fires cookieSecureProblem — that is cookiePlainHttpProblem's territory", () => {
		expect(cookieSecureProblem(lines({ gateway_HOST: "http://example.com", command_COOKIE_SECURE: "true" }))).toBeNull()
	})
})

describe("cookiePlainHttpProblem", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)

	test("fires on an explicit http:// gateway_HOST with command_COOKIE_SECURE=true and no HTTPS signal", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "http://192.168.1.50:8080", command_COOKIE_SECURE: "true" }))).toMatch(/command_COOKIE_SECURE MUST BE false/)
	})

	test("a bare, prefix-less gateway_HOST is the ambiguous case and does not fire — normalizeHost implies https:// there", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "192.168.1.50:8080", command_COOKIE_SECURE: "true" }))).toBeNull()
	})

	test("loopback is exempt — browsers honour Secure on http://localhost", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "http://localhost:8080", command_COOKIE_SECURE: "true" }))).toBeNull()
	})

	test("gateway_HTTPS_Redirect=true rules it out even on an explicit http:// gateway_HOST", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "http://192.168.1.50:8080", command_COOKIE_SECURE: "true", gateway_HTTPS_Redirect: "true" }))).toBeNull()
	})

	test("certbot_ON=true rules it out even on an explicit http:// gateway_HOST", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "http://192.168.1.50:8080", command_COOKIE_SECURE: "true", certbot_ON: "true" }))).toBeNull()
	})

	test("the check is skipped when the command service is off", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "http://192.168.1.50:8080", command_ON: "false", command_COOKIE_SECURE: "true" }))).toBeNull()
	})

	test("command_COOKIE_SECURE=false never fires it — that is cookieSecureProblem's territory", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "http://192.168.1.50:8080", command_COOKIE_SECURE: "false" }))).toBeNull()
	})

	test("a bare (unbracketed) IPv6 loopback is exempt — new URL() rejects it, so the raw host must be checked too", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "http://::1", command_COOKIE_SECURE: "true" }))).toBeNull()
	})

	test("a bracketed IPv6 loopback is exempt", () => {
		expect(cookiePlainHttpProblem(lines({ gateway_HOST: "http://[::1]", command_COOKIE_SECURE: "true" }))).toBeNull()
	})
})

describe("cookieAmbiguousHostWarning", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)

	test("fires on a bare, prefix-less gateway_HOST with command_COOKIE_SECURE=true and no HTTPS signal", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "192.168.1.50:8080", command_COOKIE_SECURE: "true" }))).toMatch(/WARNING: gateway_HOST has no scheme/)
	})

	test("an explicit scheme rules it out — nothing is ambiguous once the scheme is written down", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "https://192.168.1.50:8080", command_COOKIE_SECURE: "true" }))).toBeNull()
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "http://192.168.1.50:8080", command_COOKIE_SECURE: "true" }))).toBeNull()
	})

	test("loopback is exempt — browsers honour Secure on localhost", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "localhost", command_COOKIE_SECURE: "true" }))).toBeNull()
	})

	test("a bare (unbracketed) IPv6 loopback is exempt — new URL() rejects it, so the raw host must be checked too", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "::1", command_COOKIE_SECURE: "true" }))).toBeNull()
	})

	test("certbot_ON=true rules it out — certbot means HTTPS, not ambiguous", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "example.com", command_COOKIE_SECURE: "true", certbot_ON: "true" }))).toBeNull()
	})

	test("gateway_HTTPS_Redirect=true rules it out — reverse-proxy TLS termination, not ambiguous", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "example.com", command_COOKIE_SECURE: "true", gateway_HTTPS_Redirect: "true" }))).toBeNull()
	})

	test("command_COOKIE_SECURE=false never fires it — that is the insecure-cookie warning's territory", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "192.168.1.50:8080", command_COOKIE_SECURE: "false" }))).toBeNull()
	})

	test("the check is skipped when the command service is off", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "192.168.1.50:8080", command_ON: "false", command_COOKIE_SECURE: "true" }))).toBeNull()
	})

	test("a blank gateway_HOST has nothing to be ambiguous about", () => {
		expect(cookieAmbiguousHostWarning(lines({ gateway_HOST: "", command_COOKIE_SECURE: "true" }))).toBeNull()
	})
})

describe("certbotPortProblem", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)

	test("certbot on a non-80 gateway_PORT blocks — the HTTP-01 challenge is the only port compose publishes", () => {
		expect(certbotPortProblem(lines({ certbot_ON: "true", gateway_PORT: "8080" }))).toMatch(/gateway_PORT MUST BE 80/)
	})

	test("an unset gateway_PORT blocks the same way — nothing answers the challenge either", () => {
		expect(certbotPortProblem(lines({ certbot_ON: "true" }))).toBeTruthy()
	})

	test("certbot on port 80 passes", () => {
		expect(certbotPortProblem(lines({ certbot_ON: "true", gateway_PORT: "80" }))).toBeNull()
	})

	test("a non-80 port passes with certbot off — BYO certs do not use HTTP-01", () => {
		expect(certbotPortProblem(lines({ certbot_ON: "false", gateway_PORT: "8080" }))).toBeNull()
		expect(certbotPortProblem(lines({ gateway_PORT: "8080" }))).toBeNull()
	})
})

describe("duplicatePortProblems", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)

	test("a duplicate PORT across two on services is caught and names both keys", () => {
		const probs = duplicatePortProblems(lines({ command_ON: "true", schedule_ON: "true", command_PORT: "8080", schedule_PORT: "8080" }))
		expect(probs).toEqual([["schedule_PORT", expect.stringMatching(/command_PORT/)]])
		expect(probs[0][1]).toMatch(/8080/)
	})

	test("gateway_PORT=443 with a blank gateway_PORT_SECURE collides with its own 443 default", () => {
		const probs = duplicatePortProblems(lines({ gateway_PORT: "443" }))
		expect(probs).toEqual([["gateway_PORT_SECURE", expect.stringMatching(/gateway_PORT/)]])
		expect(probs[0][1]).toMatch(/443/)
	})

	test("a duplicate is not caught when one of the two services is off", () => {
		expect(duplicatePortProblems(lines({ command_ON: "true", schedule_ON: "false", command_PORT: "8080", schedule_PORT: "8080" }))).toHaveLength(0)
	})

	test("a duplicate is not caught when the matching service is off even with PROXY_ON=true — a proxied service binds nothing locally", () => {
		expect(duplicatePortProblems(lines({ command_ON: "true", schedule_ON: "false", schedule_PROXY_ON: "true", command_PORT: "8080", schedule_PORT: "8080" }))).toHaveLength(0)
	})

	test("a service clashing with gateway_PORT names the service port, since the gateway port is the pinned one", () => {
		const probs = duplicatePortProblems(lines({ command_ON: "true", command_PORT: "80", gateway_PORT: "80" }))
		expect(probs).toEqual([["command_PORT", expect.stringMatching(/gateway_PORT/)]])
	})

	test("distinct ports pass", () => {
		expect(duplicatePortProblems(lines({ command_ON: "true", schedule_ON: "true", command_PORT: "8080", schedule_PORT: "8081" }))).toHaveLength(0)
	})
})

describe("setupTokenHint", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)

	test("names setup_TOKEN and how to read it back — the wizard only ever showed it as a default", () => {
		expect(setupTokenHint(lines({ command_ON: "true" }))).toMatch(/setup_TOKEN/)
		expect(setupTokenHint(lines({ command_ON: "true" }))).toMatch(/grep setup_TOKEN/)
	})

	test("no hint when the command service is off — there is no setup screen to reach", () => {
		expect(setupTokenHint(lines({ command_ON: "false" }))).toBeNull()
		expect(setupTokenHint(lines({}))).toBeNull()
	})
})

describe("envProblems", () => {
	const lines = (o) => Object.entries(o).map(([k, v]) => `${k} = ${v}`)
	const SCHEMA = [{ key: "storage_FOLDERPATH", placeholder: "Base shared file path", desc: "Base shared file path", optional: false }]

	test("the insecure-cookie gate blocks preflight, matching the boot check", () => {
		const probs = envProblems([], lines({ gateway_HOST: "example.com", command_COOKIE_SECURE: "false" }))
		expect(probs).toEqual([["command_COOKIE_SECURE", expect.stringMatching(/command_COOKIE_SECURE MUST BE true/)]])
	})

	test("the plain-http cookie gate blocks preflight too", () => {
		const probs = envProblems([], lines({ gateway_HOST: "http://192.168.1.50:8080", command_COOKIE_SECURE: "true" }))
		expect(probs).toEqual([["command_COOKIE_SECURE", expect.stringMatching(/command_COOKIE_SECURE MUST BE false/)]])
	})

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

	test("the certbot port gate blocks preflight, matching the boot check", () => {
		const probs = envProblems([], lines({ certbot_ON: "true", gateway_PORT: "8080" }))
		expect(probs).toEqual([["gateway_PORT", expect.stringMatching(/gateway_PORT MUST BE 80/)]])
	})

	test("a hand-edited value with a # is flagged even though it never went through the wizard", () => {
		const probs = envProblems(SCHEMA, lines({ storage_ON: "true", storage_FOLDERPATH: "/mnt/storage#leftover" }))
		expect(probs).toEqual([["storage_FOLDERPATH", expect.stringMatching(/cannot contain #/)]])
	})

	test("the duplicate-port gate rides along with the per-key problems", () => {
		const probs = envProblems([], lines({ command_ON: "true", schedule_ON: "true", command_PORT: "8080", schedule_PORT: "8080" }))
		expect(probs).toEqual([["schedule_PORT", expect.stringMatching(/command_PORT/)]])
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
		expect(hashTruncated(lines({ livestream_FOLDERPATH: "# frames live here" }), "livestream_FOLDERPATH")).toBeNull()
	})

	test("does not flag a key that is not set at all", () => {
		expect(hashTruncated(lines({}), "setup_TOKEN")).toBeNull()
	})

	test("does not flag a seeded default that kept the env.example comment dotenv strips", () => {
		expect(hashTruncated(lines({ storage_FOLDERPATH: "/mnt/storage/  # default; base shared file path" }), "storage_FOLDERPATH")).toBeNull()
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

	test("scheduler_AUTH is skipped when blank and schedule is off", () => {
		expect(isServiceOff(lines({ schedule_ON: "false" }), "scheduler_AUTH")).toBe(true)
	})

	test("scheduler_AUTH is validated whenever it holds a value, because the storage bypass arms on it alone", () => {
		expect(isServiceOff(lines({ schedule_ON: "false", scheduler_AUTH: "a".repeat(32) }), "scheduler_AUTH")).toBe(false)
		expect(isServiceOff(lines({ schedule_ON: "false", scheduler_AUTH: "short" }), "scheduler_AUTH")).toBe(false)
	})

	test("blanking scheduler_AUTH is a valid interactive answer when schedule is off, so the wizard cannot demand a token the deploy does not need", () => {
		expect(blankDisables(lines({ schedule_ON: "false", scheduler_AUTH: "short" }), "scheduler_AUTH")).toBe(true)
	})

	test("blanking scheduler_AUTH is rejected while schedule is on", () => {
		expect(blankDisables(lines({ schedule_ON: "true", scheduler_AUTH: "short" }), "scheduler_AUTH")).toBe(false)
	})

	test("blankDisables leaves the caller's lines untouched", () => {
		const input = lines({ schedule_ON: "false", scheduler_AUTH: "short" })
		blankDisables(input, "scheduler_AUTH")
		expect(input).toContain("scheduler_AUTH = short")
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

	test("object_MODEL_SHA256 required only once object_MODEL_URL is set", () => {
		expect(isServiceOff(lines({ object_ON: "true" }), "object_MODEL_SHA256")).toBe(true)
		expect(isServiceOff(lines({ object_ON: "true", object_MODEL_URL: "https://host/m.onnx" }), "object_MODEL_SHA256")).toBe(false)
		expect(isServiceOff(lines({ object_ON: "false", object_MODEL_URL: "https://host/m.onnx" }), "object_MODEL_SHA256")).toBe(true)
	})

	test("object_MODEL_SHA256 stays skipped when object_MODEL_URL still holds its env.example prose", () => {
		const prose = "Override URL to download the YOLOX ONNX model; requires object_MODEL_SHA256. Left blank, the first boot downloads yolox_tiny.onnx (~20 MB)"
		expect(isServiceOff(lines({ object_ON: "true", object_MODEL_URL: prose }), "object_MODEL_SHA256")).toBe(true)
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

	test.each(["gateway_PORT", "gateway_PORT_SECURE", "gateway_HOST"])("%s stays required with a stale gateway_ON=false in .env — compose interpolates gateway_PORT with no default and dies on a blank", (key) => {
		expect(isServiceOff(lines({ gateway_ON: "false" }), key)).toBe(false)
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

// `cp env.example .env` yields 0644, and --check writes nothing, so reporting the mode is the only thing that closes the loop
describe("looseMode", () => {
	const fs = require("fs")
	const os = require("os")
	const path = require("path")
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-mode-"))
	const at = (name, mode) => {
		const p = path.join(dir, name)
		fs.writeFileSync(p, "x")
		fs.chmodSync(p, mode)
		return p
	}

	afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

	// win32 and WSL's /mnt/c report a fixed mode whatever chmod does, and looseMode opts out there
	const onModes = (fs.statSync(at("probe", 0o600)).mode & 0o777) === 0o600 ? test : test.skip

	onModes("names the mode of a world-readable secret", () => {
		expect(looseMode(at("world", 0o644))).toBe("0644")
	})

	onModes("accepts the modes preflight itself writes", () => {
		expect(looseMode(at("tight", 0o640))).toBeNull()
		expect(looseMode(at("owner", 0o600))).toBeNull()
	})

	onModes("flags group-write — group 1000 could rewrite the secret, not just read it", () => {
		expect(looseMode(at("groupwrite", 0o660))).toBe("0660")
	})

	test("null for a file that is not there, so a missing artifact reports as missing", () => {
		expect(looseMode(path.join(dir, "absent"))).toBeNull()
	})
})
