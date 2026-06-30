process.env.storage_FOLDERPATH = "/tmp/storage-dbprune-test"

jest.mock("lib")
jest.mock("fs")
jest.mock("memory")
jest.mock("pm2")
jest.mock("axios")
jest.mock("pg", () => {
	const query = jest.fn(() => Promise.resolve({ rows: [] }))
	return { Pool: jest.fn(() => ({ query, on: jest.fn() })), __query: query }
})

const app = require("../backend/storage.js")
const { __query: query } = require("pg")

describe("startDbPruning", () => {
	test("prunes frame_deletes on the interval", () => {
		let prune
		const spy = jest.spyOn(global, "setInterval").mockImplementation((cb) => {
			prune = cb
			return { unref: () => {} }
		})
		app.startDbPruning()
		prune()
		const queries = query.mock.calls.map((c) => c[0])
		expect(queries).toContainEqual(expect.stringMatching(/^DELETE FROM frame_deletes WHERE timestamp < NOW\(\) - INTERVAL '30 days'$/))
		spy.mockRestore()
	})
})
