const { test, expect } = require("@playwright/test")
const { mockApi, login, json } = require("./api")

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

	test("server theme on login overrides the local default", async ({ page }) => {
		await mockApi(page, {
			"POST /authorization/login": json({ error: false, role: "admin", theme: "light" })
		})
		await page.goto("/")
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true)

		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false)
		await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("light")
	})
})
