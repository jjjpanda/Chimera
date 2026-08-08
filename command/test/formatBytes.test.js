const i18n = require("../frontend/js/i18n.js").default
const formatBytes = require("../frontend/js/formatBytes.js").default

afterEach(() => i18n.changeLanguage("en"))

test("scales by 1024 and labels the unit", () => {
	expect(formatBytes(0)).toBe("0 byte")
	expect(formatBytes(1536, 1)).toBe("1.5 kB")
	expect(formatBytes(1073741824)).toBe("1 GB")
})

test("clamps at petabytes rather than inventing a unit", () => {
	expect(formatBytes(5e18, 1)).toBe("4,440.9 PB")
})

test("follows the active language's number formatting", async () => {
	await i18n.changeLanguage("de")
	expect(formatBytes(1536, 1)).toBe("1,5 kB")
})

test("treats a non-numeric size as zero", () => {
	expect(formatBytes(undefined)).toBe("0 byte")
	expect(formatBytes(null)).toBe("0 byte")
})
