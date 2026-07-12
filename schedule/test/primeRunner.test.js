const mockClient = {
	emit: jest.fn(), on: jest.fn(), off: jest.fn(),
	timeout: jest.fn(() => mockClient), connected: false
}
const mockPost = jest.fn(() => Promise.resolve({ data: {} }))

jest.mock("pg")
jest.mock("memory", () => ({ client: () => mockClient, server: () => {} }))
jest.mock("axios", () => ({ default: { create: () => ({ post: mockPost }) } }))

const bootInstance = (instance) => {
	jest.resetModules()
	process.env.NODE_APP_INSTANCE = instance
	jest.doMock("lib", () => {
		const lib = jest.requireActual("lib")
		return {
			...lib,
			webhookAlert: jest.fn(),
			handleServerStart: (app, port, successCallback) => successCallback(),
			auth: {
				...lib.auth,
				createAuthorize: () => (req, res, next) => next(),
				connectSessionSync: () => {}
			}
		}
	})
	require("../server.js").start()
}

const runTaskListeners = () => mockClient.on.mock.calls
	.filter(([event]) => event == "runTask")
	.map(([, handler]) => handler)

describe("clustered schedule instances", () => {
	afterEach(() => {
		delete process.env.NODE_APP_INSTANCE
		jest.resetModules()
	})

	test("a cron tick broadcast fires exactly one POST across a two instance cluster", () => {
		bootInstance("0")
		bootInstance("1")

		const tick = { id: "task-abc", url: "/file/pathClean", body: {} }
		runTaskListeners().forEach(handler => handler(tick))

		expect(mockPost).toHaveBeenCalledTimes(1)
	})
})
