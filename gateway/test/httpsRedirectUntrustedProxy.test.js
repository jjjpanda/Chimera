const supertest = require("supertest")

process.env.gateway_HTTPS_Redirect = "true"
process.env.gateway_TRUST_PROXY = "false"
process.env.gateway_HOST = "https://cam.example.com"
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

	test("a trusted proxy that appends rather than overwrites does not let the client's value win", (done) => {
		process.env.gateway_TRUST_PROXY = "true"
		supertest(freshGateway())
			.get("/command/health")
			.set("X-Forwarded-Proto", "https,http")
			.expect(302, done)
	})

	// a CDN in front of an nginx that appends sends "https,http": the CDN saw https, nginx saw
	// the plain hop to the gateway. Reading nginx's entry redirects an https visit back to itself
	test("gateway_TRUST_PROXY=2 reads the hop two out, so a CDN in front of a proxy does not loop", (done) => {
		process.env.gateway_TRUST_PROXY = "2"
		supertest(freshGateway())
			.get("/command/health")
			.set("X-Forwarded-Proto", "https,http")
			.expect((res) => {
				if (res.status === 302) throw new Error("redirected despite the CDN reporting https")
			})
			.end(done)
	})

	// nginx configured the standard way replaces the header, so two hops leave one value —
	// the count is clamped to the frontmost entry, the same way express indexes X-Forwarded-For
	test("gateway_TRUST_PROXY=2 clamps to the only value when a proxy replaces the header", (done) => {
		process.env.gateway_TRUST_PROXY = "2"
		supertest(freshGateway())
			.get("/command/health")
			.set("X-Forwarded-Proto", "https")
			.expect((res) => {
				if (res.status === 302) throw new Error("redirected despite the proxy reporting https")
			})
			.end(done)
	})

	test("a value that is neither true, false nor a number trusts nothing", (done) => {
		process.env.gateway_TRUST_PROXY = "yes"
		supertest(freshGateway())
			.get("/command/health")
			.set("X-Forwarded-Proto", "https")
			.expect(302, done)
	})
})
