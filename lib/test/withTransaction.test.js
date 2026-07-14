const withTransaction = require("../utils/withTransaction.js")

describe("withTransaction", () => {
	let client
	let pool

	beforeEach(() => {
		client = {
			query: jest.fn().mockResolvedValue({ rows: [] }),
			release: jest.fn()
		}
		pool = { connect: jest.fn().mockResolvedValue(client) }
	})

	test("commits and returns the client to the pool when the work succeeds", async () => {
		await expect(withTransaction(pool, async () => "done")).resolves.toBe("done")
		expect(client.query).toHaveBeenCalledWith("COMMIT")
		expect(client.release).toHaveBeenCalledWith()
	})

	test("keeps a healthy connection when the work throws an application error", async () => {
		const rejected = new Error("current password is incorrect")
		await expect(withTransaction(pool, async () => { throw rejected })).rejects.toBe(rejected)
		expect(client.query).toHaveBeenCalledWith(expect.objectContaining({ text: "ROLLBACK" }))
		expect(client.query).not.toHaveBeenCalledWith("COMMIT")
		expect(client.release).toHaveBeenCalledWith(undefined)
	})

	test("discards the connection when the rollback cannot complete", async () => {
		const dead = new Error("Query read timeout")
		client.query.mockImplementation((config) =>
			config && config.text == "ROLLBACK" ? Promise.reject(dead) : Promise.resolve({ rows: [] })
		)
		await expect(withTransaction(pool, async () => { throw dead })).rejects.toBe(dead)
		expect(client.release).toHaveBeenCalledWith(dead)
	})

	test("bounds the rollback so a dead connection cannot hang twice", async () => {
		await expect(withTransaction(pool, async () => { throw new Error("deadlock detected") })).rejects.toThrow("deadlock detected")
		const [rollback] = client.query.mock.calls.find(([c]) => c && c.text == "ROLLBACK")
		expect(rollback.query_timeout).toBeGreaterThan(0)
	})
})
