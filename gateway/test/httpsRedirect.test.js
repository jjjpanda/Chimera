const supertest = require("supertest")

process.env.gateway_HTTPS_Redirect = "true"
process.env.gateway_TRUST_PROXY = "true"
const gateway = require("../gateway.js")

jest.mock("memory")
jest.mock("axios")

describe("gateway_HTTPS_Redirect with gateway_TRUST_PROXY=true", () => {
	test("redirects a plain request with no X-Forwarded-Proto", (done) => {
		supertest(gateway)
			.get("/command/health")
			.expect(302)
			.expect("location", /^https:\/\//, done)
	})

	test("X-Forwarded-Proto: https passes through — the proxy already served TLS", (done) => {
		supertest(gateway)
			.get("/command/health")
			.set("X-Forwarded-Proto", "https")
			.expect((res) => {
				if (res.status === 302) throw new Error("redirected despite a trusted X-Forwarded-Proto")
			})
			.end(done)
	})

	test("X-Forwarded-Proto: http still redirects", (done) => {
		supertest(gateway)
			.get("/command/health")
			.set("X-Forwarded-Proto", "http")
			.expect(302, done)
	})

	test("/.well-known/ is exempt so certbot HTTP-01 can reach it", (done) => {
		supertest(gateway)
			.get("/.well-known/acme-challenge/token")
			.expect((res) => {
				if (res.status === 302) throw new Error("redirected the ACME challenge")
			})
			.end(done)
	})
})

describe("the redirect target comes from config, not from the request", () => {
	const freshGateway = () => {
		jest.resetModules()
		return require("../gateway.js")
	}

	afterEach(() => {
		delete process.env.gateway_PORT_SECURE
		delete process.env.gateway_HOST
		jest.resetModules()
	})

	test("targets gateway_PORT_SECURE, not the port the client connected on", (done) => {
		process.env.gateway_PORT_SECURE = "8443"
		process.env.gateway_HOST = "https://192.168.1.50:8443"
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "192.168.1.50:8080")
			.expect(302)
			.expect("location", "https://192.168.1.50:8443/command/health", done)
	})

	test("drops the client's port when gateway_PORT_SECURE is 443", (done) => {
		process.env.gateway_PORT_SECURE = "443"
		process.env.gateway_HOST = "https://cam.example.com"
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "cam.example.com:8080")
			.expect("location", "https://cam.example.com/command/health", done)
	})

	test("an unset gateway_PORT_SECURE reads as 443", (done) => {
		process.env.gateway_HOST = "https://cam.example.com"
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "cam.example.com:8080")
			.expect("location", "https://cam.example.com/command/health", done)
	})

	test("the host comes from gateway_HOST, so a forged Host header cannot pick the target", (done) => {
		process.env.gateway_HOST = "https://cam.example.com"
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "phish.example.com")
			.expect("location", "https://cam.example.com/command/health", done)
	})

	test("falls back to the request host when gateway_HOST is unparseable", (done) => {
		process.env.gateway_PORT_SECURE = "8443"
		process.env.gateway_HOST = "not a valid host"
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "192.168.1.50:8080")
			.expect("location", "https://192.168.1.50:8443/command/health", done)
	})
})
