const mockPost = jest.fn(() => Promise.resolve({ data: {} }))

jest.mock("axios", () => ({ default: { create: () => ({ post: mockPost }) } }))

describe("webhookAlert", () => {
	beforeEach(() => {
		process.env.admin_alert_URL = "https://example.com/admin"
		process.env.alert_URL = "https://example.com/default"
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
})
