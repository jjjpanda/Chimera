const { test, expect } = require("@playwright/test")
const { mockApi, login, json } = require("./api")

test.describe("theme", () => {
	test("clicking a theme button updates the document, persists, and fires PUT", async ({ page }) => {
		const themePuts = []
		await mockApi(page)
		await page.route("**/authorization/theme", (route) => {
			if (route.request().method() === "PUT") {
				themePuts.push(JSON.parse(route.request().postData()))
				route.fulfill(json({ error: false }))
			} else {
				route.fallback()
			}
		})
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()

		await page.getByRole("button", { name: "light" }).click()
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false)
		await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("light")
		await expect.poll(() => themePuts.at(-1)).toEqual({ theme: "light" })

		await page.getByRole("button", { name: "dark" }).click()
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true)
		await expect.poll(() => themePuts.at(-1)).toEqual({ theme: "dark" })
	})

	test("shows a toast when saving the theme fails", async ({ page }) => {
		await mockApi(page)
		await page.route("**/authorization/theme", (route) => {
			if (route.request().method() === "PUT") {
				route.fulfill(json({ error: true }, 500))
			} else {
				route.fallback()
			}
		})
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()

		await page.getByRole("button", { name: "light" }).click()
		await expect(page.getByText("Couldn't save theme")).toBeVisible()
	})

	test("system theme follows the OS preference and reacts to changes", async ({ page }) => {
		await mockApi(page)
		await page.emulateMedia({ colorScheme: "dark" })
		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()

		await page.getByRole("button", { name: "system" }).click()
		await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("system")
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true)

		await page.emulateMedia({ colorScheme: "light" })
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false)
	})

	test("a saved theme survives logout and is restored from the server on next login", async ({ page }) => {
		let savedTheme = "system"
		await mockApi(page)
		await page.route("**/authorization/theme", (route) => {
			if (route.request().method() === "PUT") {
				savedTheme = JSON.parse(route.request().postData()).theme
				route.fulfill(json({ error: false }))
			} else {
				route.fallback()
			}
		})
		await page.route("**/authorization/login", (route) =>
			route.fulfill(json({ error: false, role: "admin", theme: savedTheme })))

		await page.goto("/")
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()

		await page.getByRole("button", { name: "dark" }).click()
		await expect.poll(() => savedTheme).toBe("dark")

		await page.getByRole("button", { name: "Log Out" }).click()
		await page.getByRole("dialog").getByRole("button", { name: "Log Out" }).click()
		await expect(page.getByPlaceholder("username")).toBeVisible()

		await page.evaluate(() => localStorage.clear())
		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true)
		await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("dark")
	})

	test("server theme on login overrides the local default", async ({ page }) => {
		await mockApi(page, {
			"POST /authorization/login": json({ error: false, role: "admin", theme: "light" })
		})
		await page.goto("/")

		await login(page)
		await expect(page.getByRole("button", { name: "Live" })).toBeVisible()
		await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false)
		await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("light")
	})
})
