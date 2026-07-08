const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

const SCRIPT = path.join(__dirname, "..", "validateEnvVars.js")

const run = (overrides) => spawnSync(process.execPath, [SCRIPT], {
	cwd: os.tmpdir(),
	env: { ...process.env, ...overrides },
	encoding: "utf8"
})

describe("validateEnvVars placeholder-secret gate", () => {
	test("blocks boot when SECRETKEY still holds the env.example placeholder", () => {
		const res = run({ SECRETKEY: "Auth secret key for hashing" })
		expect(res.stdout).toContain("PLACEHOLDER SECRET — change before deploying: SECRETKEY")
		expect(res.status).toBe(1)
	})

	test("does not flag SECRETKEY when set to a real value", () => {
		const res = run({ SECRETKEY: "a-real-secret-value" })
		expect(res.stdout).not.toContain("PLACEHOLDER SECRET — change before deploying: SECRETKEY")
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
	})
})

describe("validateEnvVars confirmPath gate", () => {
	test("skips path validation when the owning service is off", () => {
		const res = run({ storage_ON: "false", storage_FOLDERPATH: "relative/path" })
		expect(res.stdout).not.toContain("storage_FOLDERPATH SHOULD BE")
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
	})

	test("no warning when certbot_ON is not true", () => {
		const res = run({ certbot_ON: "false", gateway_PORT: "8080" })
		expect(res.stdout).not.toContain("gateway_PORT is not 80")
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
	})
})
