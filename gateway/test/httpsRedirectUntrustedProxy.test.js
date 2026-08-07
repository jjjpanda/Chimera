const path = require("path")
const fs = require("fs")
const supertest = require("supertest")

const realFile = path.join(__dirname, "../gateway.js")

process.env.gateway_HTTPS_Redirect = "true"
process.env.privateKey_FILEPATH = realFile
process.env.certificate_FILEPATH = realFile
const gateway = require("../gateway.js")

jest.mock("memory")
jest.mock("axios")

describe("gateway_HTTPS_Redirect with a local cert configured (privateKey_FILEPATH/certificate_FILEPATH, on disk)", () => {
	test("X-Forwarded-Proto: https does not bypass the redirect — trust proxy is off", (done) => {
		supertest(gateway)
			.get("/command/health")
			.set("X-Forwarded-Proto", "https")
			.expect(302, done)
	})
})

describe("gateway_HTTPS_Redirect with an auto-resolved cert on disk (certbot_ON unset, no *_FILEPATH)", () => {
	const certDir = "/etc/letsencrypt/live/cam.example.com"
	const realExistsSync = fs.existsSync.bind(fs)

	afterEach(() => {
		jest.restoreAllMocks()
		delete process.env.certbot_ON
		delete process.env.gateway_HOST
		process.env.privateKey_FILEPATH = realFile
		process.env.certificate_FILEPATH = realFile
		jest.resetModules()
	})

	test("X-Forwarded-Proto: https does not bypass the redirect — trust proxy is off", (done) => {
		delete process.env.certbot_ON
		delete process.env.privateKey_FILEPATH
		delete process.env.certificate_FILEPATH
		process.env.gateway_HOST = "https://cam.example.com"
		jest.spyOn(fs, "existsSync").mockImplementation((p) => p.startsWith(certDir) || realExistsSync(p))

		const freshGateway = require("../gateway.js")
		supertest(freshGateway)
			.get("/command/health")
			.set("X-Forwarded-Proto", "https")
			.expect(302, done)
	})
})
