jest.mock("../utils/webhookAlert.js")

const mockReq = ({ path = "/api/test", method = "GET", ua = "test-agent", ip } = {}) => ({
	path,
	method,
	headers: { "user-agent": ua, ...(ip ? { "x-forwarded-for": ip } : {}) }
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
	let nowSpy
	beforeEach(() => { nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000) })
	afterEach(() => { nowSpy.mockRestore() })

	test("sanitizes @everyone, backticks, and newlines in the User-Agent", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()
		const req = mockReq({ ua: "@everyone `rm -rf /` \r\n FAKE ALERT" })

		tracker(req, {}, next)

		expect(next).toHaveBeenCalledTimes(1)
		expect(webhookAlert).toHaveBeenCalledTimes(1)
		const [message] = webhookAlert.mock.calls[0]
		const uaLine = message.match(/USER-AGENT: (.*)/)[1]
		expect(uaLine).not.toContain("@")
		expect(uaLine).not.toContain("`")
		expect(uaLine).not.toMatch(/[\r\n]/)
	})

	test("wraps the alert body in a code fence", () => {
		const { tracker, webhookAlert } = load()
		tracker(mockReq(), {}, jest.fn())
		const [message] = webhookAlert.mock.calls[0]
		expect(message.startsWith("```\n")).toBe(true)
		expect(message.endsWith("\n```")).toBe(true)
	})

	test("stops calling webhookAlert beyond MAX alerts in the window", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		for (let i = 0; i < 35; i++) tracker(mockReq(), {}, next)

		expect(next).toHaveBeenCalledTimes(35)
		expect(webhookAlert).toHaveBeenCalledTimes(30)
	})

	test("caps globally regardless of client IP", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		for (let i = 0; i < 30; i++) tracker(mockReq({ ip: "1.1.1.1" }), {}, next)
		webhookAlert.mockClear()

		tracker(mockReq({ ip: "2.2.2.2" }), {}, next)

		expect(webhookAlert).not.toHaveBeenCalled()
	})

	test("resets the budget after the window elapses", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		for (let i = 0; i < 35; i++) tracker(mockReq(), {}, next)
		expect(webhookAlert).toHaveBeenCalledTimes(30)

		nowSpy.mockReturnValue(1000 + 60 * 1000 + 1)
		webhookAlert.mockClear()
		tracker(mockReq(), {}, next)
		expect(webhookAlert).toHaveBeenCalledTimes(1)
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
