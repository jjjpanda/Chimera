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

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
const png = () => ({ status: 200, contentType: "image/png", body: PNG })
const F0 = "/frames/20240101-120000.jpg"
const F1 = "/frames/20240101-120010.jpg"

// listFramesVideo returns time-stamped frame URLs; detections at 12:00:05 map onto F0 within tolerance
const boxMocks = {
	"POST /convert/listFramesVideo": json({ list: [F0, F1] }),
	[`GET ${F0}`]: png(),
	[`GET ${F1}`]: png(),
	"GET /object/captures/cap.jpg": png(),
	"GET /object/detections": json([
		{ image: "cap.jpg", camera: 0, timestamp: "2024-01-01T12:00:05.000Z", box: [50, 50, 100, 100], type: "person", confidence: 0.9 }
	])
}

test.describe("clip maker detection boxes", () => {
	test("single-cam renders a detection overlay when boxes are toggled on", async ({ page }) => {
		await mockApi(page, boxMocks)
		await page.goto("/")
		await login(page)
		await page.getByRole("button", { name: "Clip Maker" }).click()
		await page.getByRole("combobox").click()
		await page.getByRole("option", { name: "indoor", exact: true }).click()
		await page.getByRole("button", { name: /Load Images/ }).click()
		await page.getByText("Boxes").click()
		await expect(page.locator("svg rect").first()).toBeVisible()
	})

	test("multi-cam renders a box overlay in every camera cell", async ({ page }) => {
		await mockApi(page, boxMocks)
		await page.goto("/")
		await login(page)
		await page.getByRole("button", { name: "Clip Maker" }).click()
		await page.getByRole("button", { name: "Switch to multi-camera" }).click()
		await page.getByRole("button", { name: "indoor", exact: true }).click()
		await page.getByRole("button", { name: "outdoor", exact: true }).click()
		await page.getByRole("button", { name: /Load Images/ }).click()
		await page.getByText("Boxes").click()
		await expect(async () => {
			expect(await page.locator("svg rect").count()).toBeGreaterThanOrEqual(2)
		}).toPass()
	})
})
