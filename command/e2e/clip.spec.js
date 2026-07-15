const { test, expect } = require("@playwright/test")
const { json, mockApi, login } = require("./api")

const FRAMES = json({ list: ["/frames/x/20240101-000000.jpg", "/frames/x/20240101-000100.jpg"] })

const openMultiCamReadyToGenerate = async (page, overrides = {}) => {
	await mockApi(page, { "POST /convert/listFramesVideo": FRAMES, ...overrides })
	await page.goto("/")
	await login(page)
	await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
	await page.getByRole("button", { name: "Clip Maker" }).click()
	await expect(page).toHaveURL(/\/clip$/)
	await page.getByRole("button", { name: "Switch to multi-camera" }).click()
	await page.getByRole("button", { name: "indoor", exact: true }).click()
	await page.getByRole("button", { name: "outdoor", exact: true }).click()
	await page.getByRole("button", { name: /Load Images/ }).click()
	const generate = page.getByRole("button", { name: "Generate" })
	await expect(generate).toBeEnabled()
	await generate.click()
	return page.getByRole("button", { name: /Video/ })
}

test.describe("clip maker multi-cam generate", () => {
	test("stays on the page and reports failure when every camera fails", async ({ page }) => {
		const videoBtn = await openMultiCamReadyToGenerate(page, {
			"POST /convert/createVideo": json({ error: true })
		})
		await videoBtn.click()
		await expect(page.getByText("Generation failed")).toBeVisible()
		await expect(page).toHaveURL(/\/clip$/)
	})

	test("navigates to recordings once the server confirms", async ({ page }) => {
		const videoBtn = await openMultiCamReadyToGenerate(page, {
			"POST /convert/createVideo": json({ url: "/recordings/clip.mp4" })
		})
		await videoBtn.click()
		await expect(page).toHaveURL(/\/recordings$/)
	})
})
