const trustProxyHops = require("../utils/trustProxyHops.js")

describe("trustProxyHops", () => {
	test("true is one hop, false and blank are none", () => {
		expect(trustProxyHops("true")).toBe(1)
		expect(trustProxyHops("false")).toBe(0)
		expect(trustProxyHops("")).toBe(0)
	})

	test("a number is that many hops", () => {
		expect(trustProxyHops("2")).toBe(2)
		expect(trustProxyHops(" 3 ")).toBe(3)
		expect(trustProxyHops("0")).toBe(0)
	})

	test("anything unrecognised trusts nothing, which is the safe reading", () => {
		expect(trustProxyHops("yes")).toBe(0)
		expect(trustProxyHops("-1")).toBe(0)
		expect(trustProxyHops("1.5")).toBe(0)
	})

	test("falls back to gateway_TRUST_PROXY", () => {
		process.env.gateway_TRUST_PROXY = "2"
		expect(trustProxyHops()).toBe(2)
		delete process.env.gateway_TRUST_PROXY
		expect(trustProxyHops()).toBe(0)
	})
})
