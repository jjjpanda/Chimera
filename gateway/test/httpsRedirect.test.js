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
			.expect(504, done)
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
