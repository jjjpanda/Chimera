const EventEmitter = require("events")
const net = require("net")
const https = require("https")
const fs = require("fs")
const handleSecureServerStart = require("../utils/handleSecureServerStart.js")

jest.mock("https")
jest.mock("fs")

describe("handleSecureServerStart", () => {
	let exitSpy

	beforeEach(() => {
		exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {})
	})

	afterEach(() => {
		delete process.env.gateway_HOST
		exitSpy.mockRestore()
	})

	test("reads TLS key/cert from certPaths-derived paths", () => {
		process.env.gateway_HOST = "https://cam.example.com"
		fs.readFile.mockImplementation((p, cb) => cb(null, Buffer.from("pem")))
		https.createServer.mockReturnValue(Object.assign(new EventEmitter(), { listen: jest.fn() }))

		handleSecureServerStart({}, 443, () => {}, () => {})

		expect(fs.readFile).toHaveBeenNthCalledWith(1, "/etc/letsencrypt/live/cam.example.com/privkey.pem", expect.any(Function))
		expect(fs.readFile).toHaveBeenNthCalledWith(2, "/etc/letsencrypt/live/cam.example.com/fullchain.pem", expect.any(Function))
	})

	test("forwards the read error to failureCallback when the key file is unreadable", () => {
		const readErr = new Error("ENOENT: no such file or directory")
		fs.readFile.mockImplementation((p, cb) => cb(readErr))
		const failureCallback = jest.fn()

		handleSecureServerStart({}, 443, () => {}, failureCallback)

		expect(failureCallback).toHaveBeenCalledWith(readErr)
		expect(https.createServer).not.toHaveBeenCalled()
	})

	test("forwards the read error to failureCallback when the cert file is unreadable", () => {
		const readErr = new Error("ENOENT: no such file or directory")
		fs.readFile.mockImplementationOnce((p, cb) => cb(null, Buffer.from("pem")))
		fs.readFile.mockImplementationOnce((p, cb) => cb(readErr))
		const failureCallback = jest.fn()

		handleSecureServerStart({}, 443, () => {}, failureCallback)

		expect(failureCallback).toHaveBeenCalledWith(readErr)
		expect(https.createServer).not.toHaveBeenCalled()
	})

	test("forwards a listen error (EADDRINUSE) to failureCallback and exits non-zero", (done) => {
		fs.readFile.mockImplementation((p, cb) => cb(null, Buffer.from("pem")))
		const server = new EventEmitter()
		server.listen = jest.fn()
		https.createServer.mockReturnValue(server)

		handleSecureServerStart({}, 443, () => {}, (err) => {
			expect(err).toBeDefined()
			expect(err.code).toBe("EADDRINUSE")
			// process.exit(1) runs right after this callback returns, so check on the next tick
			setImmediate(() => {
				expect(exitSpy).toHaveBeenCalledWith(1)
				done()
			})
		})

		const err = new Error("listen EADDRINUSE")
		err.code = "EADDRINUSE"
		expect(() => server.emit("error", err)).not.toThrow()
	})

	test("a blank port fails over to failureCallback and exits non-zero instead of throwing ERR_SOCKET_BAD_PORT", () => {
		fs.readFile.mockImplementation((p, cb) => cb(null, Buffer.from("pem")))
		expect(() => new net.Server().listen("")).toThrow(/should be >= 0 and < 65536/)

		const server = new net.Server()
		jest.spyOn(server, "listen")
		https.createServer.mockReturnValue(server)
		const failureCallback = jest.fn()

		expect(() => handleSecureServerStart({}, "", () => {}, failureCallback)).not.toThrow()

		expect(server.listen).not.toHaveBeenCalled()
		expect(failureCallback).toHaveBeenCalledWith(expect.any(Error))
		expect(exitSpy).toHaveBeenCalledWith(1)
	})

	test.each([undefined, null, "  ", "abc", 0, -1, 65536, 443.5])("rejects the invalid port %p without listening, and exits non-zero", (port) => {
		fs.readFile.mockImplementation((p, cb) => cb(null, Buffer.from("pem")))
		const server = Object.assign(new EventEmitter(), { listen: jest.fn() })
		https.createServer.mockReturnValue(server)
		const failureCallback = jest.fn()

		handleSecureServerStart({}, port, () => {}, failureCallback)

		expect(failureCallback).toHaveBeenCalledWith(expect.any(Error))
		expect(server.listen).not.toHaveBeenCalled()
		expect(https.createServer).not.toHaveBeenCalled()
		expect(exitSpy).toHaveBeenCalledWith(1)
	})

	test("a runtime error after the server is already listening does not exit — only the boot-time bind failure should", () => {
		fs.readFile.mockImplementation((p, cb) => cb(null, Buffer.from("pem")))
		const server = Object.assign(new EventEmitter(), { listen: jest.fn(), listening: true })
		https.createServer.mockReturnValue(server)
		const failureCallback = jest.fn()

		handleSecureServerStart({}, 443, () => {}, failureCallback)
		const err = new Error("EMFILE, too many open files")
		err.code = "EMFILE"
		server.emit("error", err)

		expect(failureCallback).toHaveBeenCalledWith(err)
		expect(exitSpy).not.toHaveBeenCalled()
	})

	test("listens on a numeric-string port", () => {
		fs.readFile.mockImplementation((p, cb) => cb(null, Buffer.from("pem")))
		const server = Object.assign(new EventEmitter(), { listen: jest.fn() })
		https.createServer.mockReturnValue(server)

		handleSecureServerStart({}, "8443", () => {}, jest.fn())

		expect(server.listen).toHaveBeenCalledWith(8443, expect.any(Function))
		expect(exitSpy).not.toHaveBeenCalled()
	})
})
