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

	test("a spent daily budget outlives a flood of fresh short-window keys", () => {
		const { loginReserve } = makeLoginAttempts()
		loginReserve("day:ip:attacker", 1, 24 * 60 * 60 * 1000, () => {})
		for (let i = 0; i < 21000; i++) loginReserve(`flood-${i}`, 100, 15 * 60 * 1000, () => {})
		let blocked
		loginReserve("day:ip:attacker", 1, 24 * 60 * 60 * 1000, (b) => { blocked = b })
		expect(blocked).toBe(true)
	})

	// the account counter is the shortest-lived key in the map, so evicting by expiry dropped
	// exactly the counter that was blocking and handed the attacker a fresh 10 guesses
	test("a per-account counter at its max survives a flood, even though it expires first", () => {
		const { loginReserve } = makeLoginAttempts()
		for (let i = 0; i < 10; i++) loginReserve("user:victim", 10, 15 * 60 * 1000, () => {})
		for (let i = 0; i < 21000; i++) loginReserve(`day:ip:flood-${i}`, 100, 24 * 60 * 60 * 1000, () => {})
		let blocked
		loginReserve("user:victim", 10, 15 * 60 * 1000, (b) => { blocked = b })
		expect(blocked).toBe(true)
	})

	test("a saturated counter outlives a flood of same-window keys that are still under their max", () => {
		const { loginReserve } = makeLoginAttempts()
		loginReserve("saturated", 1, 60000, () => {})
		for (let i = 0; i < 21000; i++) loginReserve(`flood-${i}`, 100, 60000, () => {})
		let blocked
		loginReserve("saturated", 1, 60000, (b) => { blocked = b })
		expect(blocked).toBe(true)
	})
})
