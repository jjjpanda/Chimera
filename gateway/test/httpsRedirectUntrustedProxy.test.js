const supertest = require("supertest")

process.env.gateway_HTTPS_Redirect = "true"
process.env.gateway_TRUST_PROXY = "false"
const gateway = require("../gateway.js")

jest.mock("memory")
jest.mock("axios")

const freshGateway = () => {
	jest.resetModules()
	return require("../gateway.js")
}

describe("gateway_HTTPS_Redirect without gateway_TRUST_PROXY", () => {
	afterEach(() => {
		process.env.gateway_TRUST_PROXY = "false"
		jest.resetModules()
	})

	test("X-Forwarded-Proto: https does not bypass the redirect — the header is forgeable", (done) => {
		supertest(gateway)
			.get("/command/health")
			.set("X-Forwarded-Proto", "https")
			.expect(302, done)
	})

	test("an unset gateway_TRUST_PROXY reads the same as false", (done) => {
		delete process.env.gateway_TRUST_PROXY
		supertest(freshGateway())
			.get("/command/health")
			.set("X-Forwarded-Proto", "https")
			.expect(302, done)
	})

	test("gateway_TRUST_PROXY=true is what lets the header through", (done) => {
		process.env.gateway_TRUST_PROXY = "true"
		supertest(freshGateway())
			.get("/command/health")
			.set("X-Forwarded-Proto", "https")
			.expect((res) => {
				if (res.status === 302) throw new Error("redirected despite a trusted X-Forwarded-Proto")
			})
			.end(done)
	})
})
