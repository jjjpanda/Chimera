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
