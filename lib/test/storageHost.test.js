const storageHost = require("../utils/storageHost.js")

describe("storageHost", () => {
	beforeEach(() => {
		delete process.env.storage_HOST
	})

	test("adds https:// when protocol is missing", () => {
		process.env.storage_HOST = "storage.example.com"
		expect(storageHost()).toBe("https://storage.example.com")
	})

	test("leaves an explicit https:// host untouched", () => {
		process.env.storage_HOST = "https://storage.example.com"
		expect(storageHost()).toBe("https://storage.example.com")
	})

	test("leaves an explicit http:// host untouched", () => {
		process.env.storage_HOST = "http://127.0.0.1:8081"
		expect(storageHost()).toBe("http://127.0.0.1:8081")
	})

	test("empty string when storage_HOST is unset", () => {
		expect(storageHost()).toBe("")
	})

	test("empty string when storage_HOST is blank", () => {
		process.env.storage_HOST = "   "
		expect(storageHost()).toBe("")
	})
})
