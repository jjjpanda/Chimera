const { EventEmitter } = require("events")

const queryFn = jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 }))

const mockedPool = {
	query: queryFn,
	connect: jest.fn(() => Promise.resolve(Object.assign(new EventEmitter(), { query: queryFn, release: jest.fn() }))),
	end: jest.fn(),
	on: jest.fn()
}

module.exports = {
	Pool: jest.fn(() => mockedPool),
	mockedPool
}
