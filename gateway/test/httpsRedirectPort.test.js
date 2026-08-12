const supertest = require("supertest")

process.env.gateway_HTTPS_Redirect = "true"
process.env.gateway_TRUST_PROXY = "false"

jest.mock("memory")
jest.mock("axios")

const freshGateway = () => {
	jest.resetModules()
	return require("../gateway.js")
}

describe("gateway_HTTPS_Redirect with no usable gateway_HOST", () => {
	const original = process.env.gateway_PORT_SECURE

	beforeEach(() => {
		process.env.gateway_PORT_SECURE = ""
		process.env.gateway_HOST = ""
	})

	afterEach(() => {
		if (original === undefined) delete process.env.gateway_PORT_SECURE
		else process.env.gateway_PORT_SECURE = original
		delete process.env.gateway_HOST
		jest.resetModules()
	})

	test("refuses the request instead of redirecting to the Host header the client sent", (done) => {
		supertest(freshGateway())
			.get("/clip")
			.set("Host", "phish.example.com")
			.expect(500)
			.expect((res) => {
				if (res.headers.location) throw new Error("redirected to a client-supplied target")
			})
			.end(done)
	})

	test("refuses on a non-443 gateway_PORT_SECURE too — the port never makes the target trustworthy", (done) => {
		process.env.gateway_PORT_SECURE = "8443"
		supertest(freshGateway())
			.get("/clip")
			.set("Host", "phish.example.com:8080")
			.expect(500, done)
	})

	test("/.well-known/ stays reachable so certbot can still issue the certificate that fixes this", (done) => {
		supertest(freshGateway())
			.get("/.well-known/acme-challenge/token")
			.expect((res) => {
				if (res.status === 500) throw new Error("blocked the ACME challenge")
			})
			.end(done)
	})
})
