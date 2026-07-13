const timingSafeCompare = require("../utils/timingSafeCompare.js")

describe("timingSafeCompare", () => {
	test("accepts matching strings", () => {
		expect(timingSafeCompare("secret-token", "secret-token")).toBe(true)
	})

	test("rejects mismatched strings of the same length", () => {
		expect(timingSafeCompare("secret-token", "secret-tokeN")).toBe(false)
	})

	test("rejects strings of different lengths", () => {
		expect(timingSafeCompare("short", "a-much-longer-value")).toBe(false)
	})

	test("rejects when either value is undefined", () => {
		expect(timingSafeCompare(undefined, "secret-token")).toBe(false)
		expect(timingSafeCompare("secret-token", undefined)).toBe(false)
		expect(timingSafeCompare(undefined, undefined)).toBe(false)
	})

	test("rejects non-string values", () => {
		expect(timingSafeCompare(123, 123)).toBe(false)
		expect(timingSafeCompare({}, {})).toBe(false)
	})

	test("rejects empty strings, so a blank secret never matches a blank header", () => {
		expect(timingSafeCompare("", "")).toBe(false)
		expect(timingSafeCompare("", "secret-token")).toBe(false)
		expect(timingSafeCompare("secret-token", "")).toBe(false)
	})
})
