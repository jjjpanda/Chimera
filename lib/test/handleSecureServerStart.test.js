const EventEmitter = require("events")
const https = require("https")
const fs = require("fs")
const handleSecureServerStart = require("../utils/handleSecureServerStart.js")

jest.mock("https")
jest.mock("fs")

describe("handleSecureServerStart", () => {
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
