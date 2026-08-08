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

	test("brackets a bare IPv6 literal so it parses", () => {
		expect(parses("::1")).toBe("[::1]")
		expect(parses("2001:db8::1")).toBe("[2001:db8::1]")
	})

	test("leaves an already-bracketed IPv6 host alone", () => {
		expect(parses("[::1]:8443")).toBe("[::1]:8443")
	})

	test("does not bracket a host that carries userinfo — two colons are not an IPv6 literal", () => {
		expect(normalizeHost("https://user:pass@cam.example.com:8443")).toBe("https://user:pass@cam.example.com:8443")
		expect(parses("user:pass@cam.example.com:8443")).toBe("cam.example.com:8443")
	})
})
