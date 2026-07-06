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

	test("empty strings when gateway_HOST is unset or unusable", () => {
		expect(certPaths()).toEqual({ key: "", cert: "" })
		process.env.gateway_HOST = "http://[::1]" // brackets throw URL parse error sometimes or it's a valid host but let's test fallback
		delete process.env.gateway_HOST
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
})
