const supertest = require("supertest")

process.env.gateway_HTTPS_Redirect = "true"
process.env.gateway_TRUST_PROXY = "false"

jest.mock("memory")
jest.mock("axios")

const freshGateway = () => {
	jest.resetModules()
	return require("../gateway.js")
}

describe("gateway_HTTPS_Redirect target port", () => {
	const original = process.env.gateway_PORT_SECURE

	beforeEach(() => {
		process.env.gateway_PORT_SECURE = ""
	})

	afterEach(() => {
		if (original === undefined) delete process.env.gateway_PORT_SECURE
		else process.env.gateway_PORT_SECURE = original
		jest.resetModules()
	})

	test("a request dialled on port 80 redirects with no port suffix when gateway_PORT_SECURE is unset (defaults to 443)", (done) => {
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "example.com:80")
			.expect("location", "https://example.com/command/health")
			.expect(302, done)
	})

	test("a request dialled on a non-80 port redirects to the secure port, not back to the dialled port", (done) => {
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "example.com:8080")
			.expect("location", "https://example.com/command/health")
			.expect(302, done)
	})

	test("appends a non-443 gateway_PORT_SECURE instead of reusing the dialled port", (done) => {
		process.env.gateway_PORT_SECURE = "8443"
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "example.com:80")
			.expect("location", "https://example.com:8443/command/health")
			.expect(302, done)
	})

	test("preserves an IPv6 literal host while stripping its dialled port", (done) => {
		supertest(freshGateway())
			.get("/command/health")
			.set("Host", "[::1]:8080")
			.expect("location", "https://[::1]/command/health")
			.expect(302, done)
	})
})
