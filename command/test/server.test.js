process.env.SECRETKEY = "test-secret"

jest.mock("lib")
jest.mock("pg")
jest.mock("pm2")
jest.mock("axios")
jest.mock("memory")

const { handleServerStart } = require("lib")

process.env.command_ON = "true"
const { start } = require("../server")

describe("server startup guard", () => {
	afterEach(() => {
		handleServerStart.mockReset()
		delete process.env.setup_TOKEN
	})

	test("throws when setup_TOKEN is missing", () => {
		expect(() => start()).toThrow("setup_TOKEN")
	})

	test("calls handleServerStart when setup_TOKEN is set", () => {
		process.env.setup_TOKEN = "secret"
		expect(() => start()).not.toThrow()
		expect(handleServerStart).toHaveBeenCalled()
	})
})
