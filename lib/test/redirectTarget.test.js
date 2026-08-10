const redirectTarget = require("../utils/redirectTarget.js")

describe("redirectTarget", () => {
	test("appends gateway_PORT_SECURE when gateway_HOST names no port", () => {
		expect(redirectTarget({ host: "https://cam.example.com", securePort: "8443", trustProxy: false })).toBe("cam.example.com:8443")
	})

	test("443 needs no suffix — browsers drop it", () => {
		expect(redirectTarget({ host: "https://cam.example.com", securePort: "443", trustProxy: false })).toBe("cam.example.com")
	})

	test("a port on an https gateway_HOST wins, because that is the port browsers reach", () => {
		expect(redirectTarget({ host: "https://cam.example.com:9443", securePort: "8443", trustProxy: false })).toBe("cam.example.com:9443")
	})

	test("behind a trusted proxy the container's TLS port is not the browser-facing one, so it is dropped", () => {
		expect(redirectTarget({ host: "https://cam.example.com", securePort: "8443", trustProxy: true })).toBe("cam.example.com")
	})

	test("an IPv6 literal keeps its brackets", () => {
		expect(redirectTarget({ host: "https://[2001:db8::5]", securePort: "8443", trustProxy: false })).toBe("[2001:db8::5]:8443")
	})

	test("an unusable host gives no target, so the gateway can answer 500 instead of guessing", () => {
		expect(redirectTarget({ host: "", securePort: "8443", trustProxy: false })).toBe("")
		expect(redirectTarget({ host: "not a host", securePort: "8443", trustProxy: false })).toBe("")
	})

	test("reads gateway_HOST, gateway_PORT_SECURE and gateway_TRUST_PROXY when called with nothing", () => {
		process.env.gateway_HOST = "https://cam.example.com"
		process.env.gateway_PORT_SECURE = "8443"
		process.env.gateway_TRUST_PROXY = "false"
		expect(redirectTarget()).toBe("cam.example.com:8443")
		delete process.env.gateway_HOST
		delete process.env.gateway_PORT_SECURE
		delete process.env.gateway_TRUST_PROXY
	})
})
