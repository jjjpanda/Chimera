const i18n = require("../frontend/js/i18n.js").default
const en = require("../frontend/locales/en.json")

const flatten = (obj, prefix = "") =>
	Object.entries(obj).reduce((acc, [k, v]) => {
		const key = prefix ? `${prefix}.${k}` : k
		return typeof v === "object" ? { ...acc, ...flatten(v, key) } : { ...acc, [key]: v }
	}, {})

const flat = flatten(en)

afterEach(() => i18n.changeLanguage("en"))

test("every English key holds a non-empty string", () => {
	for (const [key, value] of Object.entries(flat)) {
		expect(typeof value).toBe("string")
		expect(value.trim()).not.toBe(key)
		expect(value.trim()).not.toBe("")
	}
})

test("a key missing from a locale renders the English string, never the key and never blank", async () => {
	i18n.addResourceBundle("xx", "translation", { auth: { signIn: "Entrar" } })
	await i18n.changeLanguage("xx")

	expect(i18n.t("auth.signIn")).toBe("Entrar")
	for (const [key, value] of Object.entries(flat)) {
		if (key === "auth.signIn") continue
		expect(i18n.t(key)).toBe(value)
	}
})

test("interpolation still resolves through the English fallback", async () => {
	i18n.addResourceBundle("xx", "translation", {})
	await i18n.changeLanguage("xx")

	expect(i18n.t("errors.passwordTooShort", { minLength: 12 })).toBe("Password must be at least 12 characters.")
})
