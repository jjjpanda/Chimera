jest.mock("../utils/webhookAlert.js")

const mockReq = ({ path = "/authorization/login", method = "GET", ua = "test-agent", ip } = {}) => ({
	path,
	method,
	ip,
	headers: { "user-agent": ua }
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

	test("sanitizes @everyone, backticks, and newlines in method, path, and IP", () => {
		const { tracker, webhookAlert } = load()
		const req = mockReq({
			method: "@everyone",
			path: "/authorization/login/`test`\r\n",
			ip: "1.1.1.1\r\n@here`x`"
		})

		tracker(req, {}, jest.fn())

		const [message] = webhookAlert.mock.calls[0]
		const [firstLine, sourceLine] = message.split("\n").slice(1)
		expect(firstLine).not.toContain("@")
		expect(firstLine).not.toContain("`")
		expect(sourceLine).not.toContain("@")
		expect(sourceLine).not.toContain("`")
		expect(message).not.toMatch(/\r/)
	})

	test("truncates sanitized fields to 256 characters", () => {
		const { tracker, webhookAlert } = load()
		const req = mockReq({ ua: "A".repeat(300) })

		tracker(req, {}, jest.fn())

		const [message] = webhookAlert.mock.calls[0]
		const uaLine = message.match(/USER-AGENT: (.*)/)[1]
		expect(uaLine.length).toBe(256)
	})

	test("wraps the alert body in a code fence", () => {
		const { tracker, webhookAlert } = load()
		tracker(mockReq(), {}, jest.fn())
		const [message] = webhookAlert.mock.calls[0]
		expect(message.startsWith("```\n")).toBe(true)
		expect(message.endsWith("\n```")).toBe(true)
	})

	test("stops calling webhookAlert beyond the global MAX in the window", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		for (let i = 0; i < 35; i++) tracker(mockReq({ ip: `10.0.0.${i}` }), {}, next)

		expect(next).toHaveBeenCalledTimes(35)
		expect(webhookAlert).toHaveBeenCalledTimes(30)
	})

	test("caps a single IP without exhausting the global budget", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		for (let i = 0; i < 15; i++) tracker(mockReq({ ip: "1.1.1.1" }), {}, next)
		expect(webhookAlert).toHaveBeenCalledTimes(10)
		webhookAlert.mockClear()

		tracker(mockReq({ ip: "2.2.2.2" }), {}, next)

		expect(webhookAlert).toHaveBeenCalledTimes(1)
	})

	test("resets the budget after the window elapses", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		for (let i = 0; i < 35; i++) tracker(mockReq({ ip: `10.0.0.${i}` }), {}, next)
		expect(webhookAlert).toHaveBeenCalledTimes(30)

		nowSpy.mockReturnValue(1000 + 60 * 1000 + 1)
		webhookAlert.mockClear()
		tracker(mockReq({ ip: "10.0.0.0" }), {}, next)
		expect(webhookAlert).toHaveBeenCalledTimes(1)
	})

	test("skips non-high-impact paths (health, list, static feeds)", () => {
		const { tracker, webhookAlert } = load()
		const next = jest.fn()

		tracker(mockReq({ path: "/storage/health" }), {}, next)
		tracker(mockReq({ path: "/task/list" }), {}, next)
		tracker(mockReq({ path: "/convert/listProcess" }), {}, next)
		tracker(mockReq({ path: "/feed/x" }), {}, next)

		expect(webhookAlert).not.toHaveBeenCalled()
		expect(next).toHaveBeenCalledTimes(4)
	})

	test("alerts on high-impact routes across services", () => {
		const { tracker, webhookAlert } = load()

		for (const path of ["/authorization/login", "/convert/createVideo", "/convert/createZip", "/file/pathDelete", "/task/destroy"]) {
			tracker(mockReq({ path, ip: path }), {}, jest.fn())
		}

		expect(webhookAlert).toHaveBeenCalledTimes(5)
	})
})
