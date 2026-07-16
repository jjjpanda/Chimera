const queryFn = jest.fn(() => Promise.resolve({ rows: [{ role: "admin" }], rowCount: 1 }))

const mockedPool = {
	query: queryFn,
	end: jest.fn(),
	on: jest.fn()
}

module.exports = {
	Pool: jest.fn(() => mockedPool),
	mockedPool
}
