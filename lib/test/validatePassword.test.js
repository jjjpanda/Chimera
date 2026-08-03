const validatePassword = require("../utils/validatePassword.js")
const { minLength, requirement, tooCommon } = require("../utils/password.json")
const commonPasswords = require("../utils/commonPasswords.json")

describe("validatePassword", () => {
	test("accepts a long passphrase that is not on the blocklist", () => {
		expect(validatePassword("correct-horse-battery")).toBeNull()
	})

	test("rejects a password shorter than the minimum length", () => {
		expect(validatePassword("a".repeat(minLength - 1))).toBe(requirement)
	})

	test("accepts a password exactly at the minimum length", () => {
		expect(validatePassword("Xk4pQ2mLzT9w")).toBeNull()
	})

	test("rejects non-string values", () => {
		expect(validatePassword(undefined)).toBe(requirement)
		expect(validatePassword(null)).toBe(requirement)
		expect(validatePassword(12345678901234)).toBe(requirement)
	})

	test("rejects a blocklisted password regardless of case", () => {
		expect(validatePassword("passwordpassword")).toBe(tooCommon)
		expect(validatePassword("PasswordPassword")).toBe(tooCommon)
		expect(validatePassword("PASSWORDPASSWORD")).toBe(tooCommon)
	})

	test("every blocklist entry is rejected", () => {
		expect(commonPasswords.every((p) => validatePassword(p) === tooCommon)).toBe(true)
	})

	test("the blocklist is lowercase, deduplicated and only holds entries the length check would let through", () => {
		expect(commonPasswords.every((p) => p === p.toLowerCase() && p.length >= minLength)).toBe(true)
		expect(new Set(commonPasswords).size).toBe(commonPasswords.length)
	})
})
