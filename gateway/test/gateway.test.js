const supertest = require("supertest")
const command = require("command").app
const {handleServerStart} = require("lib")

try{
	process.env.command_PORT = parseInt(process.env.command_HOST.split(":")[2])
}
catch{
	process.exit(1)
}
const gateway = require("../server.js").app

jest.mock("memory")
jest.mock("axios")

describe("Gateway Tests", () => {
	test("Gateway Timeout when proxied server is down", (done) => {
		supertest(gateway)
			.get("/")
			.expect(504, done)
	})

	test("Gateway works when proxied server is up", (done) => {
		const server = handleServerStart(command, process.env.command_PORT, () => {
			supertest(gateway)
				.get("/")
				.expect(200, (err) => {
					server.close()
					done(err)
				})
		})
	})
})