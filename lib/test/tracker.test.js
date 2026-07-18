jest.mock("../utils/webhookAlert.js")

const mockReq = (overrides = {}) => ({
	path: "/api/test",
	method: "GET",
	headers: { "user-agent": "test-agent" },
	...overrides
})

const load = () => {
	let tracker, webhookAlert
	jest.isolateModules(() => {
		webhookAlert = require("../utils/webhookAlert.js")
		tracker = require("../utils/tracker.js")
	})
	return { tracker, webhookAlert }
}

describe("tracker", () => {
	test("sanitizes @everyone, backticks, and newlines in the User-Agent", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()
		const req = mockReq({ headers: { "user-agent": "@everyone `rm -rf /` \r\n FAKE ALERT" } })

		tracker(req, {}, next)

		expect(next).toHaveBeenCalledTimes(1)
		expect(webhookAlert).toHaveBeenCalledTimes(1)
		const [message] = webhookAlert.mock.calls[0]
		const uaLine = message.match(/USER-AGENT: (.*)/)[1]
		expect(uaLine).not.toContain("@")
		expect(uaLine).not.toContain("`")
		expect(uaLine).not.toMatch(/[\r\n]/)
	})

	test("stops calling webhookAlert beyond MAX alerts in the window", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		for (let i = 0; i < 35; i++) {
			tracker(mockReq(), {}, next)
		}

		expect(next).toHaveBeenCalledTimes(35)
		expect(webhookAlert).toHaveBeenCalledTimes(30)
	})

	test("skips /feed, /shared, and /res paths", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		tracker(mockReq({ path: "/feed/x" }), {}, next)
		tracker(mockReq({ path: "/shared/x" }), {}, next)
		tracker(mockReq({ path: "/res/x" }), {}, next)

		expect(webhookAlert).not.toHaveBeenCalled()
		expect(next).toHaveBeenCalledTimes(3)
	})
})
