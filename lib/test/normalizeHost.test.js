const normalizeHost = require("../utils/normalizeHost.js")

const parses = (h) => { try { return new URL(normalizeHost(h)).host } catch { return null } }

describe("normalizeHost", () => {
	test("adds the implied https:// and trims trailing slashes", () => {
		expect(normalizeHost(" cam.example.com/ ")).toBe("https://cam.example.com")
		expect(normalizeHost("http://127.0.0.1:8080")).toBe("http://127.0.0.1:8080")
	})

	test("blank stays blank", () => {
		expect(normalizeHost("")).toBe("")
		expect(normalizeHost(undefined)).toBe("")
	})

	test("refuses a bare IPv6 literal instead of guessing where the address ends", () => {
		expect(normalizeHost("::1")).toBe("")
		expect(normalizeHost("2001:db8::1")).toBe("")
		expect(normalizeHost("https://::1:8443")).toBe("")
		expect(normalizeHost("::ffff:192.168.1.1")).toBe("")
	})

	test("bareIPv6 flags exactly what normalizeHost refuses", () => {
		expect(normalizeHost.bareIPv6("::1")).toBe(true)
		expect(normalizeHost.bareIPv6("https://::1:8443")).toBe(true)
		expect(normalizeHost.bareIPv6("[::1]:8443")).toBe(false)
		expect(normalizeHost.bareIPv6("cam.example.com")).toBe(false)
	})

	test("leaves an already-bracketed IPv6 host alone", () => {
		expect(parses("[::1]:8443")).toBe("[::1]:8443")
	})

	test("does not bracket a host that carries userinfo — two colons are not an IPv6 literal", () => {
		expect(normalizeHost("https://user:pass@cam.example.com:8443")).toBe("https://user:pass@cam.example.com:8443")
		expect(parses("user:pass@cam.example.com:8443")).toBe("cam.example.com:8443")
	})
})
