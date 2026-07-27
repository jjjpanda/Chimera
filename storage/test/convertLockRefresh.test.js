const path = require("path")

const mockFs = {
	utimes: jest.fn((p, atime, mtime, cb) => cb && cb(null)),
	writeFile: jest.fn((p, data, cb) => cb && cb(null)),
	unlink: jest.fn((p, cb) => cb && cb(null)),
	readdir: jest.fn((p, cb) => cb(null, ["20210101-000000-00.jpg", "20210101-120000-00.jpg"])),
	createWriteStream: jest.fn(() => ({ on: () => {} }))
}

const mockFfmpegHandlers = {}

jest.mock("fs", () => ({ ...jest.requireActual("fs"), ...mockFs }))

jest.mock("cli-progress", () => ({
	SingleBar: class { start() {} update() {} stop() {} },
	Presets: { shades_classic: {} }
}))

jest.mock("fluent-ffmpeg", () => {
	const creator = {}
	const chain = () => creator
	Object.assign(creator, {
		inputFormat: chain,
		outputFPS: chain,
		videoBitrate: chain,
		videoCodec: chain,
		toFormat: chain,
		outputOptions: chain,
		mergeToFile: chain,
		pipe: chain,
		kill: () => {},
		on: (event, cb) => { mockFfmpegHandlers[event] = cb; return creator }
	})
	const ffmpeg = () => creator
	ffmpeg.setFfmpegPath = () => {}
	ffmpeg.setFfprobePath = () => {}
	return ffmpeg
})

jest.mock("lib")
jest.mock("memory")

const { createVideo } = require("../backend/routes/lib/video.js")
const { zip } = require("../backend/routes/lib/zip.js")

const START = "20210101-000000"
const END = "20210102-000000"

const lockWrites = () => mockFs.writeFile.mock.calls.map(([p]) => p)

beforeEach(() => {
	for (const fn of Object.values(mockFs)) fn.mockClear()
	for (const key of Object.keys(mockFfmpegHandlers)) delete mockFfmpegHandlers[key]
})

describe("convert lock refresh", () => {
	test("a video progress event touches the same lock file the sweep ages out", (done) => {
		createVideo({ body: { camera: "1", start: START, end: END } }, {
			send: ({ id }) => {
				const lockPath = path.join(process.env.storage_FOLDERPATH, "shared/captures", `mp4_${id}.txt`)
				expect(lockWrites()).toContain(lockPath)
				expect(mockFs.utimes).not.toHaveBeenCalled()

				mockFfmpegHandlers.progress({ frames: 1 })

				expect(mockFs.utimes).toHaveBeenCalledWith(lockPath, expect.any(Date), expect.any(Date), expect.any(Function))
				done()
			}
		})
	})

	test("a zip progress event touches the same lock file the sweep ages out", () => {
		const handlers = {}
		const archive = {
			on: (event, cb) => { handlers[event] = cb; return archive },
			pipe: () => {},
			abort: () => {},
			finalize: () => {}
		}
		let sent
		zip(archive, "1", 2, START, END, true, { body: {} }, { send: (body) => { sent = body } })

		const lockPath = path.join(process.env.storage_FOLDERPATH, "shared/captures", `zip_${sent.id}.txt`)
		expect(lockWrites()).toContain(lockPath)
		expect(mockFs.utimes).not.toHaveBeenCalled()

		handlers.progress({ entries: { processed: 1, total: 2 } })

		expect(mockFs.utimes).toHaveBeenCalledWith(lockPath, expect.any(Date), expect.any(Date), expect.any(Function))
	})

	test("the refreshed mtime is newer than the orphan-sweep threshold", () => {
		const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000
		const handlers = {}
		const archive = {
			on: (event, cb) => { handlers[event] = cb; return archive },
			pipe: () => {},
			abort: () => {},
			finalize: () => {}
		}
		zip(archive, "1", 2, START, END, true, { body: {} }, { send: () => {} })

		handlers.progress({ entries: { processed: 1, total: 2 } })

		const [, , mtime] = mockFs.utimes.mock.calls[0]
		expect(Date.now() - mtime.getTime()).toBeLessThan(ORPHAN_AGE_MS)
	})
})
