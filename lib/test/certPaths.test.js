const certPaths = require("../utils/certPaths.js")

describe("certPaths", () => {
	beforeEach(() => {
		delete process.env.gateway_HOST
		delete process.env.privateKey_FILEPATH
		delete process.env.certificate_FILEPATH
	})

	test("derives from gateway_HOST under /etc/letsencrypt/live", () => {
		process.env.gateway_HOST = "https://cam.example.com"
		expect(certPaths()).toEqual({
			key: "/etc/letsencrypt/live/cam.example.com/privkey.pem",
			cert: "/etc/letsencrypt/live/cam.example.com/fullchain.pem",
		})
	})

	test("derives correctly when gateway_HOST is missing protocol", () => {
		process.env.gateway_HOST = "cam.example.com"
		expect(certPaths()).toEqual({
			key: "/etc/letsencrypt/live/cam.example.com/privkey.pem",
			cert: "/etc/letsencrypt/live/cam.example.com/fullchain.pem",
		})
	})

	test("strips port from the host", () => {
		process.env.gateway_HOST = "https://cam.example.com:8443"
		expect(certPaths().key).toBe("/etc/letsencrypt/live/cam.example.com/privkey.pem")
	})

	test("empty strings when gateway_HOST is unset", () => {
		expect(certPaths()).toEqual({ key: "", cert: "" })
	})

	test("empty strings when gateway_HOST is unusable", () => {
		process.env.gateway_HOST = "http://[::1"
		expect(certPaths()).toEqual({ key: "", cert: "" })
	})

	test("falls back to privateKey_FILEPATH and certificate_FILEPATH if set", () => {
		process.env.privateKey_FILEPATH = "/custom/key.pem"
		process.env.certificate_FILEPATH = "/custom/cert.pem"
		expect(certPaths()).toEqual({
			key: "/custom/key.pem",
			cert: "/custom/cert.pem",
		})
	})

	test("fails closed when only one of privateKey_FILEPATH/certificate_FILEPATH is set alongside a resolvable gateway_HOST", () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
		process.env.gateway_HOST = "https://cam.example.com"
		process.env.privateKey_FILEPATH = "/custom/key.pem"
		expect(certPaths()).toEqual({ key: "", cert: "" })
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("must both be set, or neither"))
		errorSpy.mockRestore()
	})
})
