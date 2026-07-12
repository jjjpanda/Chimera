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
	env: { ...process.env, ...BASE, ...overrides },
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
		const res = run({ storage_ON: "false", storage_FOLDERPATH: "relative/path" })
		expect(res.stdout).not.toContain("storage_FOLDERPATH SHOULD BE")
		expect(res.status).toBe(0)
	})

	test("validates path when the owning service is on", () => {
		const res = run({ storage_ON: "true", storage_FOLDERPATH: "relative/path" })
		expect(res.stdout).toContain("storage_FOLDERPATH SHOULD BE AN ABSOLUTE PATH")
		expect(res.status).toBe(1)
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

describe("validateEnvVars schedule/memory cross-check", () => {
	test("blocks boot when schedule_ON=true and memory_ON is not true", () => {
		const res = run({ schedule_ON: "true", memory_ON: "false" })
		expect(res.stdout).toContain("schedule_ON=true REQUIRES memory_ON=true")
		expect(res.status).toBe(1)
	})

	test("accepts schedule_ON=true with memory_ON=true", () => {
		const res = run({ schedule_ON: "true", memory_ON: "true" })
		expect(res.stdout).not.toContain("schedule_ON=true REQUIRES memory_ON=true")
		expect(res.status).toBe(0)
	})

	test("no complaint when schedule_ON is off", () => {
		const res = run({ schedule_ON: "false", memory_ON: "false" })
		expect(res.stdout).not.toContain("schedule_ON=true REQUIRES memory_ON=true")
		expect(res.status).toBe(0)
	})

	test("accepts schedule_ON=true with memory_ON=false when chimeraInstances forces cluster mode", () => {
		const res = run({ schedule_ON: "true", memory_ON: "false", chimeraInstances: "4" })
		expect(res.stdout).not.toContain("schedule_ON=true REQUIRES memory_ON=true")
		expect(res.status).toBe(0)
	})

	test("still validates memory vars when chimeraInstances forces memory on despite memory_ON=false", () => {
		const res = run({ memory_ON: "false", chimeraInstances: "4", memory_HOST: "" })
		expect(res.stdout).toContain("MISSING ENV VAR memory_HOST")
		expect(res.status).toBe(1)
	})

	test("skips memory vars when memory_ON=false and chimeraInstances is single-instance", () => {
		const res = run({ memory_ON: "false", chimeraInstances: "1", memory_HOST: "", schedule_ON: "false" })
		expect(res.stdout).not.toContain("MISSING ENV VAR memory_HOST")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars object/livestream cross-check", () => {
	test("blocks boot when object_ON=true and livestream_ON is not true", () => {
		const res = run({ object_ON: "true", livestream_ON: "false" })
		expect(res.stdout).toContain("object_ON=true REQUIRES livestream_ON=true")
		expect(res.status).toBe(1)
	})

	test("accepts object_ON=true with livestream_ON=true", () => {
		const res = run({ object_ON: "true", livestream_ON: "true" })
		expect(res.stdout).not.toContain("object_ON=true REQUIRES livestream_ON=true")
		expect(res.status).toBe(0)
	})

	test("no complaint when object_ON is off", () => {
		const res = run({ object_ON: "false", livestream_ON: "false" })
		expect(res.stdout).not.toContain("object_ON=true REQUIRES livestream_ON=true")
		expect(res.status).toBe(0)
	})
})

describe("validateEnvVars chimeraInstances format", () => {
	test("blocks boot when chimeraInstances is not an integer or \"max\"", () => {
		const res = run({ chimeraInstances: "lots" })
		expect(res.stdout).toContain("chimeraInstances MUST BE AN INTEGER OR \"max\"")
		expect(res.status).toBe(1)
	})

	test("accepts an integer", () => {
		const res = run({ chimeraInstances: "4" })
		expect(res.stdout).not.toContain("chimeraInstances MUST BE AN INTEGER OR")
		expect(res.status).toBe(0)
	})

	test("accepts \"max\"", () => {
		const res = run({ chimeraInstances: "max" })
		expect(res.stdout).not.toContain("chimeraInstances MUST BE AN INTEGER OR")
		expect(res.status).toBe(0)
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
