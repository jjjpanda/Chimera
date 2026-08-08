const fs = require("fs")
const path = require("path")
const tags = require("lib/utils/languages.json")
const { default: i18n, changeLanguage } = require("../frontend/js/i18n.js")
const { LANGUAGES } = require("../frontend/js/languages.js")
const en = require("../frontend/locales/en.json")

const localeDir = path.join(__dirname, "../frontend/locales")
const resources = Object.fromEntries(tags.map(tag => [tag, { translation: require(`${localeDir}/${tag}.json`) }]))

const EXEMPT = {
	"clip.videoCount": "Not a plural pair — the singular is clip.video, a different string. Guarded at ClipMaker.jsx:979.",
	"clip.archiveCount": "Not a plural pair — the singular is clip.archive, a different string. Guarded at ClipMaker.jsx:986.",
	"footage.deferredSuffix": "Label form rather than a sentence; reads correctly at 1 in every locale."
}

const stripPlural = (key) => key.replace(/_(zero|one|two|few|many|other)$/, "")
const placeholders = (value) => [...value.matchAll(/{{\s*(\w+)[^}]*}}/g)].map(([, name]) => name).sort()

const flatten = (obj, prefix = "") =>
	Object.entries(obj).reduce((acc, [k, v]) => {
		const key = prefix ? `${prefix}.${k}` : k
		return typeof v === "object" ? { ...acc, ...flatten(v, key) } : { ...acc, [key]: v }
	}, {})

const flat = flatten(en)

const countBases = [...new Set(Object.entries(flat).filter(([, value]) => /{{\s*count\b/.test(value)).map(([key]) => stripPlural(key)))]
const PLURAL_BASES = countBases.filter(base => !(base in EXEMPT))

afterEach(() => i18n.changeLanguage("en"))

test("every exempted key still exists and is not secretly pluralised", () => {
	for (const base of Object.keys(EXEMPT)) {
		expect(flat[base]).toBeDefined()
		expect(countBases).toContain(base)
	}
})

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

test("the locale directory holds exactly the allow-listed languages", () => {
	const shipped = fs.readdirSync(localeDir).filter(file => file.endsWith(".json")).map(file => file.replace(/\.json$/, ""))

	expect(shipped.sort()).toEqual([...tags].sort())
})

test("every allow-listed language has a record with a label, a moment locale and a loader", () => {
	expect(Object.keys(LANGUAGES).sort()).toEqual([...tags].sort())
	for (const tag of tags) {
		expect(LANGUAGES[tag].label.trim()).not.toBe("")
		expect(LANGUAGES[tag].moment.trim()).not.toBe("")
		expect(LANGUAGES[tag].cronstrue.trim()).not.toBe("")
		expect(typeof LANGUAGES[tag].load).toBe("function")
	}
})

test.each(others)("%s loads its bundle on demand rather than at import", async (tag) => {
	expect(i18n.hasResourceBundle(tag, "translation")).toBe(false)

	await changeLanguage(tag)

	expect(i18n.hasResourceBundle(tag, "translation")).toBe(true)
	expect(i18n.t("auth.signIn")).toBe(flatten(resources[tag].translation)["auth.signIn"])
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
	await changeLanguage(tag)
	for (const count of [0, 1, 2, 5, 21]) {
		const rendered = i18n.t("stats.days", { count })
		expect(typeof rendered).toBe("string")
		expect(rendered.trim()).not.toBe("")
		expect(rendered).not.toMatch(/^stats\.days/)
	}
})

test("a count groups its digits in the app language, not the browser locale", async () => {
	await changeLanguage("de")
	expect(i18n.t("stats.frames", { count: 1234567 })).toBe("1.234.567 Bilder")
	expect(i18n.t("storage.frames", { count: 1 })).toBe("1 Bild")

	await changeLanguage("en")
	expect(i18n.t("stats.frames", { count: 1234567 })).toBe("1,234,567 frames")
	expect(i18n.t("storage.frames", { count: 1 })).toBe("1 frame")
})

test("interpolation still resolves through the English fallback", async () => {
	i18n.addResourceBundle("xx", "translation", {})
	await i18n.changeLanguage("xx")

	expect(i18n.t("errors.passwordTooShort", { minLength: 12 })).toBe("Password must be at least 12 characters.")
})
