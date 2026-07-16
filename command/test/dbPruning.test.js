jest.mock("memory")
jest.mock("pg")

const app = require("../backend/command.js")
const { mockedPool } = require("pg")

describe("startDbPruning", () => {
	test("prunes sessions on the interval", () => {
		let prune
		const spy = jest.spyOn(global, "setInterval").mockImplementation((cb) => {
			prune = cb
			return { unref: () => {} }
		})
		app.startDbPruning()
		prune()
		const queries = mockedPool.query.mock.calls.map((c) => c[0])
		expect(queries).toContainEqual(expect.stringMatching(/^DELETE FROM sessions WHERE revoked = TRUE OR issued_at < NOW\(\) - INTERVAL '30 days'$/))
		spy.mockRestore()
	})

	test("prunes immediately on startup, not just after the first interval elapses", () => {
		const spy = jest.spyOn(global, "setInterval").mockImplementation(() => ({ unref: () => {} }))
		app.startDbPruning()
		const queries = mockedPool.query.mock.calls.map((c) => c[0])
		expect(queries).toContainEqual(expect.stringMatching(/^DELETE FROM sessions WHERE revoked = TRUE OR issued_at < NOW\(\) - INTERVAL '30 days'$/))
		spy.mockRestore()
	})
})
