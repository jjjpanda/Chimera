const supertest = require("supertest")
const express = require("express")

process.env.gateway_HTTPS_Redirect = "false"
process.env.gateway_TRUST_PROXY = "false"
process.env.command_PROXY_ON = "true"

jest.mock("memory")
jest.mock("axios")

const echo = express()
echo.get("/echo", (req, res) => res.json(req.headers))

let server

beforeAll((done) => {
	server = echo.listen(0, "127.0.0.1", () => {
		process.env.command_HOST = `http://127.0.0.1:${server.address().port}`
		done()
	})
})

afterAll((done) => { server.close(done) })

const headersSeenBy = (request) => {
	jest.resetModules()
	return request(supertest(require("../gateway.js")).get("/echo")).expect(200).then((res) => res.body)
}

describe("forwarded headers reaching a proxied service", () => {
	afterEach(() => {
		process.env.gateway_TRUST_PROXY = "false"
		jest.resetModules()
	})

	test("sends exactly one X-Forwarded-For, so a backend on `trust proxy 1` reads the client and not the gateway", async () => {
		const headers = await headersSeenBy((r) => r)
		expect(headers["x-forwarded-for"].split(",")).toHaveLength(1)
	})

	test("an untrusted client's X-Forwarded-For is replaced, not appended to", async () => {
		const headers = await headersSeenBy((r) => r.set("X-Forwarded-For", "203.0.113.9"))
		expect(headers["x-forwarded-for"]).not.toMatch("203.0.113.9")
		expect(headers["x-forwarded-for"].split(",")).toHaveLength(1)
	})

	test("with gateway_TRUST_PROXY=true the front proxy's client address is passed on alone", async () => {
		process.env.gateway_TRUST_PROXY = "true"
		const headers = await headersSeenBy((r) => r.set("X-Forwarded-For", "203.0.113.9"))
		expect(headers["x-forwarded-for"]).toBe("203.0.113.9")
	})

	test("an appended X-Forwarded-Proto reaches the backend as the single value the gateway resolved", async () => {
		process.env.gateway_TRUST_PROXY = "true"
		const headers = await headersSeenBy((r) => r.set("X-Forwarded-Proto", "https,http"))
		expect(headers["x-forwarded-proto"]).toBe("http")
	})
})
