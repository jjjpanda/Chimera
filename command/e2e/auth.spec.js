const { test, expect } = require("@playwright/test")
const { json, mockApi } = require("./api")

test.describe("authentication", () => {
	test("first-time setup form is shown and submits", async ({ page }) => {
		await mockApi(page, { "GET /authorization/status": json({ setup: false, tokenRequired: true }) })
		await page.goto("/")
		await expect(page.getByText("Create your account")).toBeVisible()
		await page.getByPlaceholder("username").fill("admin")
		await page.getByPlaceholder("password", { exact: true }).fill("password123")
		await page.getByPlaceholder("confirm password").fill("password123")
		await page.getByPlaceholder("setup token").fill("boot-token")
		await page.getByRole("button", { name: "Create Account" }).click()
		await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
	})

	test("setup form shows token field when a setup token is required", async ({ page }) => {
		await mockApi(page, { "GET /authorization/status": json({ setup: false, tokenRequired: true }) })
		await page.goto("/")
		await expect(page.getByPlaceholder("setup token")).toBeVisible()
	})

	test("setup is unavailable when no setup token is configured", async ({ page }) => {
		await mockApi(page, { "GET /authorization/status": json({ setup: false, tokenRequired: false }) })
		await page.goto("/")
		await expect(page.getByText("Setup unavailable")).toBeVisible()
		await expect(page.getByRole("button", { name: "Create Account" })).not.toBeVisible()
	})

	test("login page is shown when set up but not authenticated", async ({ page }) => {
		await mockApi(page)
		await page.goto("/")
		await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
	})

	test("wrong credentials show an error", async ({ page }) => {
		await mockApi(page, { "POST /authorization/login": json({ error: true }) })
		await page.goto("/")
		await page.getByPlaceholder("username").fill("admin")
		await page.getByPlaceholder("password").fill("wrong")
		await page.getByRole("button", { name: "Sign In" }).click()
		await expect(page.getByText("Invalid username or password.")).toBeVisible()
	})

	test("rate-limited login shows the server message", async ({ page }) => {
		await mockApi(page, { "POST /authorization/login": json({ error: true, errors: "Too many attempts" }, 429) })
		await page.goto("/")
		await page.getByPlaceholder("username").fill("admin")
		await page.getByPlaceholder("password").fill("password123")
		await page.getByRole("button", { name: "Sign In" }).click()
		await expect(page.getByText("Too many attempts")).toBeVisible()
	})

	test("setup rejects a password shorter than 8 characters", async ({ page }) => {
		await mockApi(page, { "GET /authorization/status": json({ setup: false, tokenRequired: true }) })
		await page.goto("/")
		await page.getByPlaceholder("username").fill("admin")
		await page.getByPlaceholder("password", { exact: true }).fill("short")
		await page.getByRole("button", { name: "Create Account" }).click()
		await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible()
	})

	test("forced password change rejects a password shorter than 8 characters", async ({ page, context }) => {
		await context.addCookies([{ name: "bearertoken", value: "Bearer%20token", url: "http://localhost:4173" }])
		await mockApi(page, {
			"POST /authorization/verify": json({ error: false, role: "user", forcePasswordChange: true })
		})
		await page.goto("/")
		await page.getByPlaceholder("new password").fill("short")
		await page.getByPlaceholder("confirm password").fill("short")
		await page.getByRole("button", { name: "Set Password" }).click()
		await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible()
	})

	test("successful login lands on the dashboard", async ({ page }) => {
		await mockApi(page)
		await page.goto("/")
		await page.getByPlaceholder("username").fill("admin")
		await page.getByPlaceholder("password").fill("password123")
		await page.getByRole("button", { name: "Sign In" }).click()
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
		await expect(page.getByRole("button", { name: "Admin" })).toBeVisible()
	})

	test("forced password change must be completed before reaching the app", async ({ page, context }) => {
		await context.addCookies([{ name: "bearertoken", value: "Bearer%20token", url: "http://localhost:4173" }])
		await mockApi(page, {
			"POST /authorization/verify": json({ error: false, role: "user", forcePasswordChange: true })
		})
		await page.goto("/")
		await expect(page.getByText("You must set a new password to continue.")).toBeVisible()
		await page.getByPlaceholder("new password").fill("newpass123")
		await page.getByPlaceholder("confirm password").fill("mismatch")
		await page.getByRole("button", { name: "Set Password" }).click()
		await expect(page.getByText("Passwords do not match.")).toBeVisible()
		await page.getByPlaceholder("confirm password").fill("newpass123")
		await page.getByRole("button", { name: "Set Password" }).click()
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
	})

	test("log out returns to the login page", async ({ page }) => {
		await mockApi(page)
		await page.goto("/")
		await page.getByPlaceholder("username").fill("admin")
		await page.getByPlaceholder("password").fill("password123")
		await page.getByRole("button", { name: "Sign In" }).click()
		await page.getByRole("button", { name: "Log Out" }).click()
		await page.getByRole("dialog").getByRole("button", { name: "Log Out" }).click()
		await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
	})
})
