const makeLoginAttempts = require("../lib/loginAttempts.js")

describe("loginAttempts", () => {
	test("blocks once max attempts are reserved within the window", () => {
		const { loginReserve } = makeLoginAttempts()
		const results = []
		for (let i = 0; i < 4; i++) loginReserve("k", 3, 60000, (blocked) => results.push(blocked))
		expect(results).toEqual([false, false, false, true])
	})

	test("loginRelease frees a slot back up", () => {
		const { loginReserve, loginRelease } = makeLoginAttempts()
		loginReserve("k", 1, 60000, () => {})
		loginRelease("k")
		let blocked
		loginReserve("k", 1, 60000, (b) => { blocked = b })
		expect(blocked).toBe(false)
	})

	test("a new window resets the count", () => {
		const { loginReserve } = makeLoginAttempts()
		const realNow = Date.now
		Date.now = () => 0
		loginReserve("k", 1, 1000, () => {})
		Date.now = () => 2000
		let blocked
		loginReserve("k", 1, 1000, (b) => { blocked = b })
		Date.now = realNow
		expect(blocked).toBe(false)
	})

	test("eviction drops the soonest-to-expire keys first, so a spent daily budget outlives a flood of short-window ones", () => {
		const { loginReserve } = makeLoginAttempts()
		loginReserve("day:ip:attacker", 1, 24 * 60 * 60 * 1000, () => {})
		for (let i = 0; i < 21000; i++) loginReserve(`flood-${i}`, 100, 15 * 60 * 1000, () => {})
		let blocked
		loginReserve("day:ip:attacker", 1, 24 * 60 * 60 * 1000, (b) => { blocked = b })
		expect(blocked).toBe(true)
	})

	test("eviction past MAX_KEYS is age-based, not preferential to non-saturated victim counters", () => {
		const { loginReserve } = makeLoginAttempts()
		loginReserve("saturated-old", 1, 60000, () => {})
		loginReserve("victim", 10, 60000, () => {})
		for (let i = 0; i < 20000; i++) loginReserve(`flood-${i}`, 100, 60000, () => {})
		let victimBlocked
		loginReserve("victim", 10, 60000, (b) => { victimBlocked = b })
		let saturatedBlocked
		loginReserve("saturated-old", 1, 60000, (b) => { saturatedBlocked = b })
		expect(victimBlocked).toBe(saturatedBlocked)
	})
})
