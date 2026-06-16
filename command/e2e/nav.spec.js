const { test, expect } = require("@playwright/test")
const { mockApi, login } = require("./api")

test.describe("navigation", () => {
	test.beforeEach(async ({ page }) => {
		await mockApi(page)
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
	})

	test("opens the stats page", async ({ page }) => {
		await page.getByRole("button", { name: "Stats" }).click()
		await expect(page).toHaveURL(/\/stats$/)
		await expect(page.getByText("Storage Growth")).toBeVisible()
	})

	test("opens the schedule page", async ({ page }) => {
		await page.getByRole("button", { name: "Schedule" }).click()
		await expect(page).toHaveURL(/\/schedule$/)
		await expect(page.getByText("Run History")).toBeVisible()
	})

	test("opens the objects page", async ({ page }) => {
		await page.getByRole("button", { name: "Objects" }).click()
		await expect(page).toHaveURL(/\/objects$/)
		await expect(page.getByText("object detection")).toBeVisible()
	})

	test("admin can open the user management page", async ({ page }) => {
		await page.getByRole("button", { name: "Admin" }).click()
		await expect(page).toHaveURL(/\/admin$/)
		await expect(page.getByRole("button", { name: "Add User" })).toBeVisible()
	})

	test("returns to the dashboard from another page", async ({ page }) => {
		await page.getByRole("button", { name: "Stats" }).click()
		await expect(page).toHaveURL(/\/stats$/)
		await page.getByRole("button", { name: "Home" }).click()
		await expect(page.getByText("Storage Usage")).toBeVisible()
	})
})
