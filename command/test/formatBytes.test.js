const { default: i18n, changeLanguage } = require("../frontend/js/i18n.js")
const formatBytes = require("../frontend/js/formatBytes.js").default

afterEach(() => i18n.changeLanguage("en"))

test("scales by 1024 and labels the unit with its binary name", () => {
	expect(formatBytes(0)).toBe("0 Bytes")
	expect(formatBytes(100)).toBe("100 Bytes")
	expect(formatBytes(1024)).toBe("1 KB")
	expect(formatBytes(1536, 1)).toBe("1.5 KB")
	expect(formatBytes(1073741824)).toBe("1 GB")
})

test("pluralises the byte label", () => {
	expect(formatBytes(1)).toBe("1 Byte")
	expect(formatBytes(2)).toBe("2 Bytes")
})

test("clamps at petabytes rather than inventing a unit", () => {
	expect(formatBytes(5e18, 1)).toBe("4,440.9 PB")
})

test("follows the active language's number formatting", async () => {
	await changeLanguage("de")

	expect(formatBytes(1536, 1)).toBe("1,5 KB")
	expect(formatBytes(2)).toBe("2 Byte")
})

test("takes the unit label from the active locale", async () => {
	await changeLanguage("fr")

	expect(formatBytes(1536, 1)).toBe("1,5 Ko")
	expect(formatBytes(2)).toBe("2 octets")
})

test("treats a non-numeric size as zero", () => {
	expect(formatBytes(undefined)).toBe("0 Bytes")
	expect(formatBytes(null)).toBe("0 Bytes")
})
