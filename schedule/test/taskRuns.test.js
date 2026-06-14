const supertest = require("supertest")

jest.mock("lib")
jest.mock("axios")
jest.mock("pg")
jest.mock("memory", () => ({
	client: () => ({ emit: () => {}, on: () => {}, off: () => {} }),
	server: () => {}
}))

const app = require("../backend/schedule.js")
const { mockedPool } = require("pg")

describe("Task Run History", () => {
	const cookie = "validCookie"

	describe("/task/runs", () => {
		test("returns all runs", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [
				{ id: 1, task_id: "task-auto-cleanup", url: "/file/pathAutoClean", status: "success", http_status: 200, error: null, ran_at: "2026-06-11T10:00:00Z" }
			] })
			const res = await supertest(app).get("/task/runs").set("Cookie", cookie)
			expect(res.status).toBe(200)
			expect(res.body.runs).toHaveLength(1)
			expect(res.body.runs[0].task_id).toBe("task-auto-cleanup")
			const call = mockedPool.query.mock.calls.find(c => /task_runs/.test(c[0]))
			expect(call[1]).toEqual([])
		})

		test("returns 500 on db error", async () => {
			mockedPool.query.mockRejectedValueOnce(new Error("db error"))
			const res = await supertest(app).get("/task/runs").set("Cookie", cookie)
			expect(res.status).toBe(500)
			expect(res.body).toEqual({ error: true })
		})
	})

	describe("/task/runs/:taskId", () => {
		test("filters by task id", async () => {
			mockedPool.query.mockResolvedValueOnce({ rows: [] })
			const res = await supertest(app).get("/task/runs/task-auto-cleanup").set("Cookie", cookie)
			expect(res.status).toBe(200)
			const call = mockedPool.query.mock.calls.find(c => /task_runs/.test(c[0]) && c[1] && c[1].length)
			expect(call[0]).toMatch(/WHERE task_id=\$1/)
			expect(call[1]).toEqual(["task-auto-cleanup"])
		})
	})
})
