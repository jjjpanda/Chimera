const { test, expect } = require("@playwright/test")
const { json, mockApi, login } = require("./api")

const asUserLogin = { "POST /authorization/login": json({ error: false, role: "user" }) }
const asUserSession = { "POST /authorization/verify": json({ error: false, role: "user", forcePasswordChange: false }) }
const asAdminSession = { "POST /authorization/verify": json({ error: false, role: "admin", forcePasswordChange: false }) }

test.describe("role-based access", () => {
	test("non-admin user does not see the admin nav button", async ({ page }) => {
		await mockApi(page, asUserLogin)
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
		await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0)
	})

	test("non-admin sees View Stats instead of Manage Data", async ({ page }) => {
		await mockApi(page, asUserLogin)
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "View Stats" })).toBeVisible()
	})

	test("non-admin deep link to /admin redirects to the dashboard", async ({ page }) => {
		await mockApi(page, asUserSession)
		await page.goto("/admin")
		await expect(page.getByText("Storage Usage")).toBeVisible()
		await expect(page.getByRole("button", { name: "Add User" })).toHaveCount(0)
	})

	test("admin deep link to /admin renders user management", async ({ page }) => {
		await mockApi(page, asAdminSession)
		await page.goto("/admin")
		await expect(page.getByRole("button", { name: "Add User" })).toBeVisible()
	})

	test("non-admin deep link to /schedule redirects to the dashboard", async ({ page }) => {
		await mockApi(page, asUserSession)
		await page.goto("/schedule")
		await expect(page.getByText("Storage Usage")).toBeVisible()
		await expect(page.getByText("Schedule a Task")).toHaveCount(0)
	})

	test("admin deep link to /schedule renders the scheduler", async ({ page }) => {
		await mockApi(page, asAdminSession)
		await page.goto("/schedule")
		await expect(page.getByText("Schedule a Task")).toBeVisible()
	})
})
