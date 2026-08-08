const tags = require("lib/utils/languages.json")
const { default: i18n, resources } = require("../frontend/js/i18n.js")
const en = require("../frontend/locales/en.json")

const PLURAL_BASES = ["live.restartFailed", "stats.dayCount", "stats.days", "stats.olderThanDays"]
const stripPlural = (key) => key.replace(/_(zero|one|two|few|many|other)$/, "")
const placeholders = (value) => (value.match(/{{\s*\w+\s*}}/g) ?? []).sort()

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

const others = tags.filter(tag => tag !== "en")

const englishFor = (key) => {
	if (flat[key] !== undefined) return flat[key]
	const base = stripPlural(key)
	return flat[`${base}_other`] ?? flat[`${base}_one`] ?? flat[base]
}

const shipped = Object.keys(resources).sort()

test("every language in the allow-list ships a locale file", () => {
	expect(shipped).toEqual([...tags].sort())
})

test.each(others)("%s carries the full en.json key set", (tag) => {
	const locale = flatten(resources[tag].translation)
	const present = new Set(Object.keys(locale).map(stripPlural))
	const missing = [...new Set(Object.keys(flat).map(stripPlural))].filter(key => !present.has(key))

	expect(missing).toEqual([])
})

test.each(others)("%s keeps every interpolation placeholder", (tag) => {
	const locale = flatten(resources[tag].translation)
	for (const [key, value] of Object.entries(locale)) {
		expect(placeholders(value)).toEqual(placeholders(englishFor(key) ?? ""))
	}
})

test.each(tags)("%s declares exactly the plural categories its language uses", (tag) => {
	const categories = new Intl.PluralRules(tag).resolvedOptions().pluralCategories
	const locale = flatten(resources[tag].translation)
	for (const base of PLURAL_BASES) {
		const found = Object.keys(locale).filter(key => stripPlural(key) === base)
		expect(found.sort()).toEqual(categories.map(c => `${base}_${c}`).sort())
	}
})

test.each(others)("%s renders a plural through i18next for every category", async (tag) => {
	await i18n.changeLanguage(tag)
	for (const count of [0, 1, 2, 5, 21]) {
		const rendered = i18n.t("stats.days", { count })
		expect(typeof rendered).toBe("string")
		expect(rendered.trim()).not.toBe("")
		expect(rendered).not.toMatch(/^stats\.days/)
	}
})

test("interpolation still resolves through the English fallback", async () => {
	i18n.addResourceBundle("xx", "translation", {})
	await i18n.changeLanguage("xx")

	expect(i18n.t("errors.passwordTooShort", { minLength: 12 })).toBe("Password must be at least 12 characters.")
})
