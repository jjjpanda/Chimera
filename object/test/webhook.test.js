global.fetch = jest.fn().mockResolvedValue({})

const sendWebhook = require("../backend/lib/webhook.js")

describe("sendWebhook", () => {
	beforeEach(() => {
		fetch.mockClear()
	})

	test("does nothing when no url is given", async () => {
		await sendWebhook(undefined, "hi", Buffer.from("x"))
		expect(fetch).not.toHaveBeenCalled()
	})

	test("posts with a bounded abort signal so an unresponsive alert_URL can't hang the scan loop", async () => {
		await sendWebhook("http://hook.test", "hi", Buffer.from("x"))
		expect(fetch).toHaveBeenCalledWith("http://hook.test", expect.objectContaining({
			method: "POST",
			signal: expect.any(AbortSignal),
		}))
	})

	test("swallows fetch errors instead of throwing", async () => {
		fetch.mockRejectedValueOnce(new Error("network down"))
		await expect(sendWebhook("http://hook.test", "hi")).resolves.toBeUndefined()
	})
})
