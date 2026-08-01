const mockPost = jest.fn(() => Promise.resolve({ data: {} }))
const mockCreate = jest.fn(() => ({ post: mockPost }))

jest.mock("axios", () => ({ default: { create: (config) => mockCreate(config) } }))

describe("webhookAlert", () => {
	beforeEach(() => {
		process.env.admin_alert_URL = "https://example.com/admin"
		process.env.alert_URL = "https://example.com/default"
	})

	test("creates the axios instance with a 10s timeout", () => {
		require("../utils/webhookAlert.js")

		expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ timeout: 10000 }))
	})

	test("blocks all mentions in the payload", () => {
		const webhookAlert = require("../utils/webhookAlert.js")

		webhookAlert("hello", "admin")

		const [, body] = mockPost.mock.calls[0]
		expect(body.allowed_mentions).toEqual({ parse: [] })
	})

	test("posts to admin_alert_URL for the admin level", () => {
		const webhookAlert = require("../utils/webhookAlert.js")

		webhookAlert("hello", "admin")

		const [url] = mockPost.mock.calls[0]
		expect(url).toBe(process.env.admin_alert_URL)
	})

	test("posts to alert_URL for the default level", () => {
		const webhookAlert = require("../utils/webhookAlert.js")

		webhookAlert("hello")

		const [url] = mockPost.mock.calls[0]
		expect(url).toBe(process.env.alert_URL)
	})

	test("posts nothing when the level's URL is unset", () => {
		delete process.env.alert_URL
		const webhookAlert = require("../utils/webhookAlert.js")

		webhookAlert("hello")

		expect(mockPost).not.toHaveBeenCalled()
	})
})
