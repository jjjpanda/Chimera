const { test, expect } = require("@playwright/test")
const { mockApi, login, json } = require("./api")

const pick = async (page, label) => {
	await page.getByRole("combobox").click()
	await page.getByRole("option", { name: label }).click()
}

const expand = (page) => page.getByRole("button", { name: "Change language" }).click()

const capturePuts = async (page, puts, response = json({ error: false }), hold) =>
	page.route("**/authorization/language", async (route) => {
		if (route.request().method() !== "PUT") return route.fallback()
		puts.push(JSON.parse(route.request().postData()))
		if (hold) await hold
		return route.fulfill(response)
	})

test.describe("language", () => {
	test("the login page starts in English with the picker hidden behind Change language", async ({ page }) => {
		await mockApi(page)
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "languages", { value: ["es-ES", "es"], configurable: true })
		})
		await page.goto("/")

		await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
		await expect(page.getByRole("combobox")).toBeHidden()
		await expect(page.getByRole("button", { name: "Change language" })).toBeVisible()
	})

	test("picking a language before login translates the page and persists it locally", async ({ page }) => {
		const puts = []
		await mockApi(page)
		await capturePuts(page, puts)
		await page.goto("/")
		await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()

		await expand(page)
		await pick(page, "Español")

		await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible()
		await expect.poll(() => page.evaluate(() => localStorage.getItem("language"))).toBe("es")
		await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("es")
		expect(puts).toHaveLength(0)
	})

	test("a language picked on the login page survives the login and is saved to the account", async ({ page }) => {
		const puts = []
		await mockApi(page)
		await capturePuts(page, puts)
		await page.goto("/")
		await expand(page)
		await pick(page, "Español")
		await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible()

		await page.getByPlaceholder("nombre de usuario").fill("admin")
		await page.getByPlaceholder("contraseña").fill("password123")
		await page.getByRole("button", { name: "Iniciar sesión" }).click()

		await expect(page.getByRole("button", { name: "En vivo" })).toBeVisible()
		await expect.poll(() => puts.at(-1)).toEqual({ language: "es" })
		await expect.poll(() => page.evaluate(() => localStorage.getItem("language"))).toBe("es")
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

	test("a failed save toasts in the active language and rolls the selection back", async ({ page }) => {
		let release
		const held = new Promise((resolve) => { release = resolve })
		await mockApi(page, {
			"POST /authorization/login": json({ error: false, role: "admin", theme: "system", language: "es" })
		})
		await capturePuts(page, [], json({ error: true }, 500), held)
		await page.goto("/")
		await login(page)
		await page.getByRole("button", { name: "Cuenta" }).click()

		await pick(page, "Deutsch")
		await expect(page.getByRole("button", { name: "Passwort ändern" })).toBeVisible()
		release()

		await expect(page.getByText("Sprache konnte nicht gespeichert werden")).toBeVisible()
		await expect(page.getByRole("button", { name: "Cambiar contraseña" })).toBeVisible()
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
