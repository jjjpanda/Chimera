const queryFn = jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 }))

const mockedPool = {
	query: queryFn,
	end: jest.fn(),
	on: jest.fn()
}

module.exports = {
	Pool: jest.fn(() => mockedPool),
	mockedPool
}
