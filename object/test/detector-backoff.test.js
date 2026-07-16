jest.mock("onnxruntime-node", () => ({ InferenceSession: { create: jest.fn() } }))
jest.mock("../backend/lib/model.js", () => ({ ensureModel: jest.fn() }))

describe("detector.load backoff", () => {
	let ort, ensureModel, load, now

	beforeEach(() => {
		jest.resetModules()
		ort = require("onnxruntime-node")
		ensureModel = require("../backend/lib/model.js").ensureModel
		load = require("../backend/lib/detector.js").load
		now = 1000000
		jest.spyOn(Date, "now").mockImplementation(() => now)
	})

	afterEach(() => {
		Date.now.mockRestore()
	})

	test("caches the failure and refuses to retry until the backoff window elapses", async () => {
		ensureModel.mockRejectedValue(new Error("model download failed: 500"))
		await expect(load()).rejects.toThrow("model download failed: 500")
		expect(ensureModel).toHaveBeenCalledTimes(1)

		now += 4999
		await expect(load()).rejects.toThrow("model download failed: 500")
		expect(ensureModel).toHaveBeenCalledTimes(1)
	})

	test("retries after the backoff elapses, doubling the window on repeat failure", async () => {
		ensureModel.mockRejectedValue(new Error("boom"))
		await expect(load()).rejects.toThrow("boom")
		expect(ensureModel).toHaveBeenCalledTimes(1)

		now += 5000
		await expect(load()).rejects.toThrow("boom")
		expect(ensureModel).toHaveBeenCalledTimes(2)

		now += 9999
		await expect(load()).rejects.toThrow("boom")
		expect(ensureModel).toHaveBeenCalledTimes(2)

		now += 1
		await expect(load()).rejects.toThrow("boom")
		expect(ensureModel).toHaveBeenCalledTimes(3)
	})

	test("resolves and caches the session after a successful attempt following a prior failure", async () => {
		const session = { inputNames: ["in"], outputNames: ["out"] }
		ensureModel.mockRejectedValueOnce(new Error("boom"))
		await expect(load()).rejects.toThrow("boom")

		now += 5000
		ensureModel.mockResolvedValueOnce("/model/path")
		ort.InferenceSession.create.mockResolvedValueOnce(session)
		await expect(load()).resolves.toBe(session)
		expect(ensureModel).toHaveBeenCalledTimes(2)

		await expect(load()).resolves.toBe(session)
		expect(ensureModel).toHaveBeenCalledTimes(2)
	})
})
