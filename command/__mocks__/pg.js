const bcrypt = jest.requireActual("bcryptjs")
const hashedMockedPassword = bcrypt.hashSync("mockedPassword", bcrypt.genSaltSync(10))

const queryFn = jest.fn((str, paramsOrCallback, callback) => {
	const result = str.includes("COUNT")
		? { rows: [{ count: "0" }] }
		: { rows: [{ hash: hashedMockedPassword }] }
	const cb = typeof paramsOrCallback === "function" ? paramsOrCallback : (typeof callback === "function" ? callback : null)
	if (cb) cb(null, result)
	return Promise.resolve(result)
})

const mockedPool = {
	connect: jest.fn(() => Promise.resolve({ query: queryFn, release: jest.fn() })),
	query: queryFn,
	end: jest.fn(),
	on: jest.fn()
}

module.exports = {
	Pool: jest.fn(() => mockedPool),
	mockedPool
}
