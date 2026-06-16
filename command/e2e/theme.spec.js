const { test, expect } = require("@playwright/test")
const { mockApi, login } = require("./api")

test.describe("theme", () => {
	test("toggling the theme switch updates the document and persists", async ({ page }) => {
		await mockApi(page)
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()

		const wasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
		await page.getByRole("switch").click()
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(!wasDark)
		await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe(wasDark ? "light" : "dark")
	})
})
