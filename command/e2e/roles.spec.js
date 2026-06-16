const { test, expect } = require("@playwright/test")
const { json, mockApi, login } = require("./api")

const asUser = {
	"POST /authorization/login": json({ error: false, role: "user" }),
	"POST /authorization/verify": json({ error: false, role: "user", forcePasswordChange: false })
}

test.describe("role-based access", () => {
	test("non-admin user does not see the admin nav button", async ({ page }) => {
		await mockApi(page, asUser)
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
		await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0)
	})

	test("non-admin sees View Stats instead of Manage Data", async ({ page }) => {
		await mockApi(page, asUser)
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "View Stats" })).toBeVisible()
	})

	test("non-admin deep link to /admin redirects to the dashboard", async ({ page, context }) => {
		await context.addCookies([{ name: "bearertoken", value: "Bearer%20token", url: "http://localhost:4173" }])
		await mockApi(page, asUser)
		await page.goto("/admin")
		await expect(page.getByText("Storage Usage")).toBeVisible()
		await expect(page.getByRole("button", { name: "Add User" })).toHaveCount(0)
	})

	test("admin deep link to /admin renders user management", async ({ page, context }) => {
		await context.addCookies([{ name: "bearertoken", value: "Bearer%20token", url: "http://localhost:4173" }])
		await mockApi(page)
		await page.goto("/admin")
		await expect(page.getByRole("button", { name: "Add User" })).toBeVisible()
	})
})
