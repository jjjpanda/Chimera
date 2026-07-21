const fs = require("fs")
const os = require("os")
const path = require("path")
const readSecret = require("../utils/readSecret.js")

describe("readSecret", () => {
	const ORIGINAL_ENV = process.env

	beforeEach(() => {
		process.env = { ...ORIGINAL_ENV }
	})

	afterAll(() => {
		process.env = ORIGINAL_ENV
	})

	test("falls back to the plain env var when no _FILE variant is set", () => {
		process.env.SECRETKEY = "plain-value"
		expect(readSecret("SECRETKEY")).toBe("plain-value")
	})

	test("reads and trims the file contents when the _FILE variant is set", () => {
		const file = path.join(os.tmpdir(), `readSecret-test-${Date.now()}`)
		fs.writeFileSync(file, "file-value\n")
		process.env.SECRETKEY_FILE = file
		process.env.SECRETKEY = "plain-value"
		expect(readSecret("SECRETKEY")).toBe("file-value")
		fs.unlinkSync(file)
	})

	test("returns undefined instead of throwing when the _FILE target is missing", () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {})
		process.env.SECRETKEY_FILE = path.join(os.tmpdir(), `readSecret-missing-${Date.now()}`)
		process.env.SECRETKEY = "plain-value"
		expect(readSecret("SECRETKEY")).toBeUndefined()
		expect(spy).toHaveBeenCalled()
		spy.mockRestore()
	})

	test("returns undefined instead of throwing when the _FILE target is unreadable", () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {})
		const readSpy = jest.spyOn(fs, "readFileSync").mockImplementation(() => {
			const e = new Error("EACCES: permission denied")
			e.code = "EACCES"
			throw e
		})
		process.env.SECRETKEY_FILE = path.join(os.tmpdir(), "readSecret-eacces")
		expect(readSecret("SECRETKEY")).toBeUndefined()
		expect(spy).toHaveBeenCalled()
		readSpy.mockRestore()
		spy.mockRestore()
	})
})
