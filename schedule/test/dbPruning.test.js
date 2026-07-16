jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => ({ emit: () => {}, on: () => {}, off: () => {} }),
	server: () => {}
}))

const { startDbPruning } = require("../backend/routes/lib/scheduler.js")
const { mockedPool } = require("pg")

describe("startDbPruning", () => {
	test("prunes task_runs on the interval", () => {
		let prune
		const spy = jest.spyOn(global, "setInterval").mockImplementation((cb) => {
			prune = cb
			return { unref: () => {} }
		})
		startDbPruning()
		prune()
		const queries = mockedPool.query.mock.calls.map((c) => c[0])
		expect(queries).toContainEqual(expect.stringMatching(/^DELETE FROM task_runs WHERE ran_at < NOW\(\) - INTERVAL '30 days'$/))
		expect(queries).not.toContainEqual(expect.stringContaining("frame_deletes"))
		expect(queries).not.toContainEqual(expect.stringContaining("sessions"))
		spy.mockRestore()
	})
})
