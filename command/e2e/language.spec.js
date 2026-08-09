const { test, expect } = require("@playwright/test")
const { mockApi, login, json } = require("./api")

const pick = async (page, label) => {
	await page.getByRole("combobox").click()
	await page.getByRole("option", { name: label }).click()
}

const capturePuts = async (page, puts, response = json({ error: false })) =>
	page.route("**/authorization/language", (route) => {
		if (route.request().method() === "PUT") {
			puts.push(JSON.parse(route.request().postData()))
			route.fulfill(response)
		} else {
			route.fallback()
		}
	})

test.describe("language", () => {
	test("picking a language before login translates the page and persists it locally", async ({ page }) => {
		const puts = []
		await mockApi(page)
		await capturePuts(page, puts)
		await page.goto("/")
		await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()

		await pick(page, "Español")

		await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible()
		await expect.poll(() => page.evaluate(() => localStorage.getItem("language"))).toBe("es")
		await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("es")
		expect(puts).toHaveLength(0)
	})

	test("picking a language while signed in translates the app and fires PUT", async ({ page }) => {
		const puts = []
		await mockApi(page)
		await capturePuts(page, puts)
		await page.goto("/")
		await login(page)
		await page.getByRole("button", { name: "Account" }).click()

		await pick(page, "Deutsch")

		await expect(page.getByRole("button", { name: "Passwort ändern" })).toBeVisible()
		await expect.poll(() => puts.at(-1)).toEqual({ language: "de" })
		await expect.poll(() => page.evaluate(() => localStorage.getItem("language"))).toBe("de")
	})

	test("shows a toast in the active language when saving fails", async ({ page }) => {
		await mockApi(page, {
			"POST /authorization/login": json({ error: false, role: "admin", theme: "system", language: "es" })
		})
		await capturePuts(page, [], json({ error: true }, 500))
		await page.goto("/")
		await login(page)
		await page.getByRole("button", { name: "Cuenta" }).click()

		await pick(page, "Deutsch")

		await expect(page.getByText("No se pudo guardar el idioma")).toBeVisible()
	})

	test("server language on login overrides the local default", async ({ page }) => {
		await mockApi(page, {
			"POST /authorization/login": json({ error: false, role: "admin", theme: "system", language: "es" })
		})
		await page.goto("/")

		await login(page)

		await expect(page.getByRole("button", { name: "En vivo" })).toBeVisible()
		await expect.poll(() => page.evaluate(() => localStorage.getItem("language"))).toBe("es")
	})
})
