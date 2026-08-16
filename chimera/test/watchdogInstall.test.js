const fs = require("fs")
const os = require("os")
const path = require("path")

jest.mock("fs")

const ROOT = path.join(__dirname, "..", "..")
const SCRIPT = path.join(__dirname, "..", "watchdog.js")

const runOn = (platform) => {
	Object.defineProperty(process, "platform", { value: platform, configurable: true })
	jest.spyOn(os, "userInfo").mockReturnValue({ username: "chimera" })
	jest.spyOn(console, "log").mockImplementation(() => {})
	jest.isolateModules(() => require("../watchdogInstall.js"))
}

const written = () => fs.writeFileSync.mock.calls[0]

const ORIGINAL_PLATFORM = process.platform

describe("watchdogInstall", () => {
	afterEach(() => Object.defineProperty(process, "platform", { value: ORIGINAL_PLATFORM, configurable: true }))

	test("linux writes a systemd unit that starts watchdog.js and enables at boot", () => {
		runOn("linux")

		const [file, contents] = written()
		expect(file).toBe(path.join(ROOT, "chimera-watchdog.service"))
		expect(contents).toContain(`ExecStart=${process.execPath} ${SCRIPT}`)
		expect(contents).toContain("Restart=always")
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining("systemctl enable --now chimera-watchdog"))
	})

	test("darwin writes a launchd plist that starts watchdog.js and loads at login", () => {
		runOn("darwin")

		const [file, contents] = written()
		expect(file).toBe(path.join(ROOT, "com.chimera.watchdog.plist"))
		expect(contents).toContain(`<string>${SCRIPT}</string>`)
		expect(contents).toContain("<key>RunAtLoad</key>")
		expect(contents).toContain("<key>StandardOutPath</key>")
		expect(contents).toContain("<key>StandardErrorPath</key>")
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining("launchctl load"))
	})

	test("win32 writes no file, only prints the Task Scheduler command", () => {
		runOn("win32")

		expect(fs.writeFileSync).not.toHaveBeenCalled()
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Register-ScheduledTask"))
	})

	test("unsupported platform exits 1 without writing anything", () => {
		jest.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit") })
		jest.spyOn(console, "error").mockImplementation(() => {})

		expect(() => runOn("aix")).toThrow("exit")

		expect(fs.writeFileSync).not.toHaveBeenCalled()
		expect(console.error).toHaveBeenCalledWith(expect.stringContaining("unsupported platform: aix"))
		expect(process.exit).toHaveBeenCalledWith(1)
	})
})
