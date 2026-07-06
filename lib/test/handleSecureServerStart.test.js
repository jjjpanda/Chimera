const EventEmitter = require("events")
const https = require("https")
const fs = require("fs")
const handleSecureServerStart = require("../utils/handleSecureServerStart.js")

jest.mock("https")
jest.mock("fs")

describe("handleSecureServerStart", () => {
	afterEach(() => { delete process.env.gateway_HOST })

	test("reads TLS key/cert from certPaths-derived paths", () => {
		process.env.gateway_HOST = "https://cam.example.com"
		fs.readFile.mockImplementation((p, cb) => cb(null, Buffer.from("pem")))
		https.createServer.mockReturnValue(Object.assign(new EventEmitter(), { listen: jest.fn() }))

		handleSecureServerStart({}, 443, () => {}, () => {})

		expect(fs.readFile).toHaveBeenNthCalledWith(1, "/etc/letsencrypt/live/cam.example.com/privkey.pem", expect.any(Function))
		expect(fs.readFile).toHaveBeenNthCalledWith(2, "/etc/letsencrypt/live/cam.example.com/fullchain.pem", expect.any(Function))
	})

	test("forwards a listen error (EADDRINUSE) to failureCallback instead of crashing", (done) => {
		fs.readFile.mockImplementation((p, cb) => cb(null, Buffer.from("pem")))
		const server = new EventEmitter()
		server.listen = jest.fn()
		https.createServer.mockReturnValue(server)

		handleSecureServerStart({}, 443, () => {}, (err) => {
			expect(err).toBeDefined()
			expect(err.code).toBe("EADDRINUSE")
			done()
		})

		const err = new Error("listen EADDRINUSE")
		err.code = "EADDRINUSE"
		expect(() => server.emit("error", err)).not.toThrow()
	})
})
