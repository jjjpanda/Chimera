jest.mock("lib", () => ({
	...jest.requireActual("lib"),
	handleServerStart: jest.fn(),
	handleSecureServerStart: jest.fn(),
	watchCertRenewal: jest.fn()
}))

const {handleSecureServerStart} = require("lib")
const server = require("../server.js")

describe("Gateway Secure Port", () => {
	const original = process.env.gateway_PORT_SECURE

	beforeEach(() => { process.env.gateway_ON = "true" })
	afterEach(() => {
		if (original === undefined) delete process.env.gateway_PORT_SECURE
		else process.env.gateway_PORT_SECURE = original
	})

	test("falls back to 443 when gateway_PORT_SECURE is blank", () => {
		process.env.gateway_PORT_SECURE = ""

		server.start()

		expect(handleSecureServerStart).toHaveBeenCalledWith(expect.anything(), 443, expect.any(Function), expect.any(Function))
	})

	test("uses gateway_PORT_SECURE when it is set", () => {
		process.env.gateway_PORT_SECURE = "8443"

		server.start()

		expect(handleSecureServerStart).toHaveBeenCalledWith(expect.anything(), "8443", expect.any(Function), expect.any(Function))
	})
})
