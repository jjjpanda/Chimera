const { compileTrustedSources, validTrustedSources } = require("../utils/trustedSources.js")

describe("compileTrustedSources", () => {
	test.each([undefined, "", "   "])("falls back to loopback for %p", (sources) => {
		const trusted = compileTrustedSources(sources)
		expect(trusted("127.0.0.1", 0)).toBe(true)
		expect(trusted("10.0.0.5", 0)).toBe(false)
	})

	test("honours an explicit CIDR list", () => {
		const trusted = compileTrustedSources("10.0.0.0/8")
		expect(trusted("10.1.2.3", 0)).toBe(true)
		expect(trusted("127.0.0.1", 0)).toBe(false)
	})

	test.each([",", " , , ", "loopbak", "10.0.0.0/99"])("throws on %p", (sources) => {
		expect(() => compileTrustedSources(sources)).toThrow()
	})
})

describe("validTrustedSources", () => {
	test.each([undefined, "", "   ", "loopback", "10.0.0.0/8", "loopback,10.0.0.0/8"])("accepts %p", (sources) => {
		expect(validTrustedSources(sources)).toBe(true)
	})

	test.each([",", " , , ", "loopbak", "not an ip"])("rejects %p", (sources) => {
		expect(validTrustedSources(sources)).toBe(false)
	})
})
