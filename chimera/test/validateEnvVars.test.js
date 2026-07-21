const os = require("os")
const fs = require("fs")
const path = require("path")
const { parse } = require("dotenv")
const { spawnSync } = require("child_process")

const SCRIPT = path.join(__dirname, "..", "validateEnvVars.js")
const CI_ENV = parse(fs.readFileSync(path.join(__dirname, "..", "..", ".github", "ci.env")))
const BASE = { ...CI_ENV, storage_FOLDERPATH: os.tmpdir(), livestream_FOLDERPATH: os.tmpdir() }

const run = (overrides) => spawnSync(process.execPath, [SCRIPT], {
	cwd: os.tmpdir(),
	env: { ...BASE, ...overrides },
	encoding: "utf8"
})

describe("validateEnvVars against the CI env file", () => {
	test("the checked-in ci.env passes validation", () => {
		const res = run({})
		expect(res.stdout).toBe("")
		expect(res.status).toBe(0)
	})

	test("blocks boot when setup_TOKEN is unset — /authorization/setup is publicly reachable without it", () => {
		const res = run({ setup_TOKEN: "" })
		expect(res.stdout).toContain("MISSING ENV VAR setup_TOKEN")
		expect(res.status).toBe(1)
	})

	test("blocks boot when scheduler_AUTH is blank while the schedule service is on", () => {
		const res = run({ schedule_ON: "true", scheduler_AUTH: "" })
		expect(res.stdout).toContain("MISSING ENV VAR scheduler_AUTH")
		expect(res.status).toBe(1)
	})

	test("allows a blank scheduler_AUTH when the schedule service is off — preflight seeds it blank", () => {
		const res = run({ schedule_ON: "false", schedule_PROXY_ON: "false", scheduler_AUTH: "" })
		expect(res.stdout).toBe("")
		expect(res.status).toBe(0)
	})

	test("allows a blank memory_AUTH_TOKEN when the memory service is off", () => {
		const res = run({ memory_ON: "false", chimeraInstances: "1", memory_AUTH_TOKEN: "" })
		expect(res.stdout).toBe("")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars placeholder-secret gate", () => {
	test("blocks boot when SECRETKEY still holds the env.example placeholder", () => {
		const res = run({ SECRETKEY: "Auth secret key for hashing, min 32 characters" })
		expect(res.stdout).toContain("PLACEHOLDER SECRET — change before deploying: SECRETKEY")
		expect(res.status).toBe(1)
	})

	test("does not flag SECRETKEY when set to a real value", () => {
		const res = run({ SECRETKEY: "a-real-secret-value-thats-long-enough" })
		expect(res.stdout).not.toContain("PLACEHOLDER SECRET — change before deploying: SECRETKEY")
		expect(res.status).toBe(0)
	})

	test("blocks boot when SECRETKEY is shorter than 32 characters", () => {
		const res = run({ SECRETKEY: "too-short-a-secret" })
		expect(res.stdout).toContain("SECRETKEY TOO SHORT — must be at least 32 characters: SECRETKEY")
		expect(res.status).toBe(1)
	})

	test("accepts SECRETKEY at least 32 characters long", () => {
		const res = run({ SECRETKEY: "a".repeat(32) })
		expect(res.stdout).not.toContain("SECRETKEY TOO SHORT")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars confirmURL gate", () => {
	test("blocks boot when alert_URL is not a valid URL", () => {
		const res = run({ alert_URL: "not a url" })
		expect(res.stdout).toContain("alert_URL MUST BE A VALID http(s) URL")
		expect(res.status).toBe(1)
	})

	test("blocks boot when alert_URL uses a non-http(s) scheme", () => {
		const res = run({ alert_URL: "javascript:alert(1)" })
		expect(res.stdout).toContain("alert_URL MUST BE A VALID http(s) URL")
		expect(res.status).toBe(1)
	})

	test("accepts a valid alert_URL", () => {
		const res = run({ alert_URL: "https://example.com/hook" })
		expect(res.stdout).not.toContain("alert_URL MUST BE A VALID http(s) URL")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars confirmPath gate", () => {
	test("skips path validation when the owning service is off", () => {
		const res = run({ storage_ON: "false", object_ON: "false", storage_FOLDERPATH: "relative/path" })
		expect(res.stdout).not.toContain("storage_FOLDERPATH SHOULD BE")
		expect(res.status).toBe(0)
	})

	test("validates path when the owning service is on", () => {
		const res = run({ storage_ON: "true", storage_FOLDERPATH: "relative/path" })
		expect(res.stdout).toContain("storage_FOLDERPATH SHOULD BE AN ABSOLUTE PATH")
		expect(res.status).toBe(1)
	})
})

describe("validateEnvVars object/livestream dependency gate", () => {
	const MESSAGE = "object_ON requires livestream_ON"

	test("blocks boot when object is on and livestream is off — object scans an HLS feed nothing writes", () => {
		const res = run({ object_ON: "true", livestream_ON: "false", livestream_PROXY_ON: "false" })
		expect(res.stdout).toContain(MESSAGE)
		expect(res.status).toBe(1)
	})

	test("accepts object alongside livestream", () => {
		const res = run({ object_ON: "true", livestream_ON: "true" })
		expect(res.stdout).not.toContain(MESSAGE)
		expect(res.status).toBe(0)
	})

	test("livestream_PROXY_ON does not excuse it — it only routes gateway HTTP to livestream_HOST, nothing writes the local livestream_FOLDERPATH", () => {
		const res = run({ object_ON: "true", livestream_ON: "false", livestream_PROXY_ON: "true" })
		expect(res.stdout).toContain(MESSAGE)
		expect(res.status).toBe(1)
	})

	test("quiet when object is off", () => {
		const res = run({ object_ON: "false", livestream_ON: "false", livestream_PROXY_ON: "false" })
		expect(res.stdout).not.toContain(MESSAGE)
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars certbot port warning", () => {
	test("warns (non-fatal) when certbot_ON=true and gateway_PORT is not 80", () => {
		const res = run({ certbot_ON: "true", gateway_PORT: "8080" })
		expect(res.stdout).toContain("gateway_PORT is not 80")
	})

	test("no warning when gateway_PORT is 80", () => {
		const res = run({ certbot_ON: "true", gateway_PORT: "80" })
		expect(res.stdout).not.toContain("gateway_PORT is not 80")
		expect(res.status).toBe(0)
	})

	test("no warning when certbot_ON is not true", () => {
		const res = run({ certbot_ON: "false", gateway_PORT: "8080" })
		expect(res.stdout).not.toContain("gateway_PORT is not 80")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars insecure-cookie warning", () => {
	test("warns (non-fatal) on a public gateway_HOST with insecure cookie flags", () => {
		const res = run({ gateway_HOST: "example.com", command_COOKIE_SECURE: "false", gateway_HTTPS_Redirect: "false" })
		expect(res.stdout).toContain("WARNING: auth cookie may be sent over plaintext HTTP")
		expect(res.status).toBe(0)
	})

	test("no warning on a loopback gateway_HOST", () => {
		const res = run({ gateway_HOST: "127.0.0.1", command_COOKIE_SECURE: "false", gateway_HTTPS_Redirect: "false" })
		expect(res.stdout).not.toContain("WARNING: auth cookie may be sent over plaintext HTTP")
		expect(res.status).toBe(0)
	})

	test("no warning on a public gateway_HOST when both secure flags are set", () => {
		const res = run({ gateway_HOST: "example.com", command_COOKIE_SECURE: "true", gateway_HTTPS_Redirect: "true" })
		expect(res.stdout).not.toContain("WARNING: auth cookie may be sent over plaintext HTTP")
		expect(res.status).toBe(0)
	})

	test("no warning when command_COOKIE_SECURE is set, regardless of gateway_HTTPS_Redirect (reverse-proxy TLS termination)", () => {
		const res = run({ gateway_HOST: "example.com", command_COOKIE_SECURE: "true", gateway_HTTPS_Redirect: "false" })
		expect(res.stdout).not.toContain("WARNING: auth cookie may be sent over plaintext HTTP")
		expect(res.status).toBe(0)
	})

	test("no warning on a bracketed IPv6 loopback gateway_HOST", () => {
		const res = run({ gateway_HOST: "[::1]", command_COOKIE_SECURE: "false", gateway_HTTPS_Redirect: "false" })
		expect(res.stdout).not.toContain("WARNING: auth cookie may be sent over plaintext HTTP")
		expect(res.status).toBe(0)
	})

	test("warns when only gateway_HTTPS_Redirect is set (command_COOKIE_SECURE still false)", () => {
		const res = run({ gateway_HOST: "example.com", command_COOKIE_SECURE: "false", gateway_HTTPS_Redirect: "true" })
		expect(res.stdout).toContain("WARNING: auth cookie may be sent over plaintext HTTP")
		expect(res.status).toBe(0)
	})

	test("warns on a malformed gateway_HOST instead of silently skipping the check", () => {
		const res = run({ gateway_HOST: "not a valid host", command_COOKIE_SECURE: "false", gateway_HTTPS_Redirect: "false" })
		expect(res.stdout).toContain("WARNING: auth cookie may be sent over plaintext HTTP")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars memory_ON cluster override", () => {
	test("announces the override when a cluster overrules memory_ON=false", () => {
		const res = run({ memory_ON: "false", chimeraInstances: "4" })
		expect(res.stdout).toContain("FORCING memory_ON=true")
		expect(res.status).toBe(0)
	})

	test("stays quiet when memory_ON is already true", () => {
		const res = run({ memory_ON: "true", chimeraInstances: "4" })
		expect(res.stdout).toBe("")
		expect(res.status).toBe(0)
	})

	test("the override does not mask an invalid memory_ON", () => {
		const res = run({ memory_ON: "maybe", chimeraInstances: "4" })
		expect(res.stdout).toContain("MUST BE true OR false: memory_ON")
		expect(res.status).toBe(1)
	})

	test("still validates memory vars when chimeraInstances forces memory on despite memory_ON=false", () => {
		const res = run({ memory_ON: "false", chimeraInstances: "4", memory_HOST: "" })
		expect(res.stdout).toContain("MISSING ENV VAR memory_HOST")
		expect(res.status).toBe(1)
	})

	test("skips memory vars when memory_ON=false and chimeraInstances is single-instance", () => {
		const res = run({ memory_ON: "false", chimeraInstances: "1", memory_HOST: "" })
		expect(res.stdout).not.toContain("MISSING ENV VAR memory_HOST")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars chimeraInstances format", () => {
	test.each(["lots", "2.5", "4x", "-2", "-8"])("blocks boot on %s", (val) => {
		const res = run({ chimeraInstances: val })
		expect(res.stdout).toContain("chimeraInstances MUST BE")
		expect(res.status).toBe(1)
	})

	test("blocks boot when chimeraInstances is blank", () => {
		const res = run({ chimeraInstances: "" })
		expect(res.stdout).toContain("MISSING ENV VAR chimeraInstances")
		expect(res.status).toBe(1)
	})

	test.each(["1", "4", "max", "0", "-1"])("accepts %s", (val) => {
		const res = run({ chimeraInstances: val })
		expect(res.stdout).not.toContain("chimeraInstances MUST BE")
		expect(res.status).toBe(0)
	})

	test.each(["max", "0", "-1", "4"])("%s forces a cluster, so memory vars stay required", (val) => {
		const res = run({ chimeraInstances: val, memory_ON: "false", memory_PORT: "" })
		expect(res.stdout).toContain("MISSING ENV VAR memory_PORT")
		expect(res.status).toBe(1)
	})
})

describe("validateEnvVars scheduler_TRUSTED_SOURCES gate", () => {
	test.each(["loopbak", "10.0.0.0/99", "not an ip", ",", " , , "])("blocks boot on %s", (val) => {
		const res = run({ scheduler_TRUSTED_SOURCES: val })
		expect(res.stdout).toContain("scheduler_TRUSTED_SOURCES MUST BE")
		expect(res.status).toBe(1)
	})

	test.each(["loopback", "10.0.0.0/8", "127.0.0.1", "loopback,10.0.0.0/8", ""])("accepts %s", (val) => {
		const res = run({ scheduler_TRUSTED_SOURCES: val })
		expect(res.stdout).not.toContain("scheduler_TRUSTED_SOURCES MUST BE")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars storage_HOST protocol gate", () => {
	const MESSAGE = "storage_HOST MUST START WITH http:// OR https://"

	test.each(["127.0.0.1:8081", "storage.server.example"])("blocks boot on a protocol-less %s — an implied https:// fails the TLS handshake", (val) => {
		const res = run({ storage_HOST: val })
		expect(res.stdout).toContain(MESSAGE)
		expect(res.status).toBe(1)
	})

	test.each(["http://127.0.0.1:7820", "https://storage.server.example"])("accepts %s", (val) => {
		const res = run({ storage_HOST: val })
		expect(res.stdout).not.toContain(MESSAGE)
	})

	test("blocks boot for a proxied-but-not-local storage — the gateway still dials storage_HOST", () => {
		const res = run({ storage_ON: "false", storage_PROXY_ON: "true", schedule_ON: "false", schedule_PROXY_ON: "false", scheduler_AUTH: "", storage_HOST: "storage.example.com" })
		expect(res.stdout).toContain(MESSAGE)
		expect(res.status).toBe(1)
	})

	test("quiet when storage is off and nothing dials storage_HOST", () => {
		const res = run({ storage_ON: "false", storage_PROXY_ON: "false", schedule_ON: "false", schedule_PROXY_ON: "false", scheduler_AUTH: "", storage_HOST: "127.0.0.1:8081" })
		expect(res.stdout).not.toContain(MESSAGE)
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars storage_HOST behind the gateway", () => {
	const WARNING = "storage_HOST points at gateway_HOST"

	test("warns when storage_HOST resolves to the gateway — the Authorization strip 401s every cron", () => {
		const res = run({ schedule_ON: "true", storage_HOST: "http://127.0.0.1:7922" })
		expect(res.stdout).toContain(WARNING)
		expect(res.status).toBe(0)
	})

	test("quiet when storage_HOST shares a hostname but not a port with the gateway", () => {
		const res = run({ schedule_ON: "true", storage_HOST: "http://127.0.0.1:7820" })
		expect(res.stdout).not.toContain(WARNING)
	})

	test("quiet when the schedule service is off", () => {
		const res = run({ schedule_ON: "false", schedule_PROXY_ON: "false", scheduler_AUTH: "", storage_HOST: "http://127.0.0.1:7922" })
		expect(res.stdout).not.toContain(WARNING)
	})
})

describe("validateEnvVars off-box storage_HOST against the default loopback trust", () => {
	const WARNING = "storage_HOST is not loopback but scheduler_TRUSTED_SOURCES is unset"

	test("warns when storage_HOST is off-box and the trust list is left at the loopback default", () => {
		const res = run({ schedule_ON: "true", storage_ON: "false", storage_PROXY_ON: "false", storage_HOST: "http://10.0.0.5:7820", scheduler_TRUSTED_SOURCES: "" })
		expect(res.stdout).toContain(WARNING)
		expect(res.status).toBe(0)
	})

	test("quiet once scheduler_TRUSTED_SOURCES covers the off-box range", () => {
		const res = run({ schedule_ON: "true", storage_ON: "false", storage_PROXY_ON: "false", storage_HOST: "http://10.0.0.5:7820", scheduler_TRUSTED_SOURCES: "10.0.0.0/8" })
		expect(res.stdout).not.toContain(WARNING)
	})

	test("quiet for a loopback storage_HOST", () => {
		const res = run({ schedule_ON: "true", storage_HOST: "http://127.0.0.1:7820", scheduler_TRUSTED_SOURCES: "" })
		expect(res.stdout).not.toContain(WARNING)
	})

	test("quiet when the schedule service is off", () => {
		const res = run({ schedule_ON: "false", schedule_PROXY_ON: "false", scheduler_AUTH: "", storage_HOST: "http://10.0.0.5:7820", scheduler_TRUSTED_SOURCES: "" })
		expect(res.stdout).not.toContain(WARNING)
	})
})

describe("validateEnvVars bool gate", () => {
	test("blocks boot when a bool var is not exactly true/false", () => {
		const res = run({ command_ON: "yes" })
		expect(res.stdout).toContain("MUST BE true OR false: command_ON")
		expect(res.status).toBe(1)
	})

	test("accepts a bool var set to true", () => {
		const res = run({ command_ON: "true" })
		expect(res.stdout).not.toContain("MUST BE true OR false: command_ON")
		expect(res.status).toBe(0)
	})
})
