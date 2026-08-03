const { EventEmitter } = require("events")
const moment = require("moment")

const frameFiles = [
	"20210101-000000-00.jpg",
	"20210101-030000-00.jpg",
	"20210101-060000-00.jpg",
	"20210101-090000-00.jpg",
	"20210101-120000-00.jpg",
	"20210101-150000-00.jpg",
	"20210101-180000-00.jpg",
	"20210101-210000-00.jpg",
	"20210102-000000-00.jpg",
]

const framesInWindow = (camera, from, to) => String(camera) !== "1" ? [] : frameFiles.filter((name) => {
	const at = moment.utc(name.slice(0, 15), "YYYYMMDD-HHmmss")
	return !at.isBefore(moment.utc(from, "YYYY-MM-DD HH:mm:ss")) && at.isBefore(moment.utc(to, "YYYY-MM-DD HH:mm:ss").add(1, "second"))
})

const frameListRows = (sql, [camera, from, to, step, limit]) => {
	const window = framesInWindow(camera, from, to)
	const every = /GREATEST\(\$4,/.test(sql)
		? Math.max(Number(step), Math.ceil(window.length / Number(limit)))
		: Math.max(Math.ceil(window.length / Number(step)), 1)
	return window.filter((name, index) => index % every === 0).slice(0, Number(limit)).map((name) => ({ name }))
}

const queryFn = jest.fn((sql, params) =>
	Promise.resolve(/AS idx/.test(sql) ? { rows: frameListRows(sql, params) } : { rows: [], rowCount: 0 })
)

const mockedPool = {
	query: queryFn,
	connect: jest.fn(() => Promise.resolve(Object.assign(new EventEmitter(), { query: queryFn, release: jest.fn() }))),
	end: jest.fn(),
	on: jest.fn()
}

module.exports = {
	Pool: jest.fn(() => mockedPool),
	mockedPool,
	frameFiles
}
