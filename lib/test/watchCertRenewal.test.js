const fs = require("fs")
const pm2 = require("pm2")
const watchCertRenewal = require("../utils/watchCertRenewal.js")

jest.mock("fs")
jest.mock("pm2", () => ({ restart: jest.fn() }))

const TICK = 1000

describe("watchCertRenewal", () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.setSystemTime(new Date(Date.UTC(2020, 0, 1, 3, 30)))
		process.env.gateway_ON = "true"
		process.env.gateway_HOST = "https://x"
		fs.statSync.mockReturnValue({ mtimeMs: 1000 })
	})
	afterEach(() => jest.useRealTimers())

	test("no restart when mtime unchanged", () => {
		watchCertRenewal(3, 4, TICK)
		jest.advanceTimersByTime(TICK)
		expect(pm2.restart).not.toHaveBeenCalled()
	})

	test("no restart when mtime changed but outside the window", () => {
		jest.setSystemTime(new Date(Date.UTC(2020, 0, 1, 10, 30)))
		watchCertRenewal(3, 4, TICK)
		fs.statSync.mockReturnValue({ mtimeMs: 2000 })
		jest.advanceTimersByTime(TICK)
		expect(pm2.restart).not.toHaveBeenCalled()
	})

	test("restart when mtime changed inside the window", () => {
		watchCertRenewal(3, 4, TICK)
		fs.statSync.mockReturnValue({ mtimeMs: 2000 })
		jest.advanceTimersByTime(TICK)
		expect(pm2.restart).toHaveBeenCalledTimes(1)
		expect(pm2.restart).toHaveBeenCalledWith("gateway", expect.any(Function))
	})

	test("restarts immediately on initial cert creation, ignoring the time window", () => {
		jest.setSystemTime(new Date(Date.UTC(2020, 0, 1, 10, 30)))
		fs.statSync.mockImplementation(() => { throw new Error("ENOENT") })
		watchCertRenewal(3, 4, TICK)

		fs.statSync.mockReturnValue({ mtimeMs: Date.now() })
		jest.advanceTimersByTime(TICK)
		expect(pm2.restart).toHaveBeenCalledTimes(1)
		expect(pm2.restart).toHaveBeenCalledWith("gateway", expect.any(Function))
	})

	test("no-op when gateway_ON is not true", () => {
		process.env.gateway_ON = "false"
		expect(watchCertRenewal()).toBeUndefined()
	})

	test("no-op when gateway_HOST is unset", () => {
		delete process.env.gateway_HOST
		expect(watchCertRenewal()).toBeUndefined()
	})
})
