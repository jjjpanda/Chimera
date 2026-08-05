const path = require("path")

const mockOutputHandlers = {}

const mockFs = {
	utimes: jest.fn((p, atime, mtime, cb) => cb && cb(null)),
	writeFile: jest.fn((p, data, cb) => cb && cb(null)),
	unlink: jest.fn((p, cb) => cb && cb(null)),
	readdir: jest.fn((p, cb) => cb(null, ["20210101-000000-00.jpg", "20210101-120000-00.jpg"])),
	createWriteStream: jest.fn(() => ({ on: (event, cb) => { mockOutputHandlers[event] = cb } }))
}

const mockFfmpegHandlers = {}
const mockArchiveHandlers = {}

jest.mock("fs", () => ({ ...jest.requireActual("fs"), ...mockFs }))

jest.mock("archiver", () => {
	const archive = {
		on: (event, cb) => { mockArchiveHandlers[event] = cb; return archive },
		file: () => {},
		pipe: () => {},
		abort: () => {},
		finalize: () => {}
	}
	return { ZipArchive: function() { return archive } }
})

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
jest.mock("pg")

const flush = async () => { for(let i = 0; i < 3; i++) await Promise.resolve() }

const { createVideo } = require("../backend/routes/lib/video.js")
const { createZip } = require("../backend/routes/lib/zip.js")
const { EXPORT_LOCK_ACTIVE_MS, EXPORT_LOCK_REFRESH_MS, exportLockName } = require("../backend/routes/lib/file.js")
const memory = require("memory")

const START = "20210101-000000"
const END = "20210102-000000"

const lockWrites = () => mockFs.writeFile.mock.calls.map(([p]) => p)

const zipLockPath = () => lockWrites().find(p => /zip_.+\.txt$/.test(p))

const cancelEnder = () => {
	const saved = memory.__emitted.find(e => e.event === "saveProcessEnder")
	saved.args[1](true)
}

beforeEach(() => {
	jest.useFakeTimers()
	for (const fn of Object.values(mockFs)) fn.mockClear()
	for (const key of Object.keys(mockFfmpegHandlers)) delete mockFfmpegHandlers[key]
	for (const key of Object.keys(mockArchiveHandlers)) delete mockArchiveHandlers[key]
	for (const key of Object.keys(mockOutputHandlers)) delete mockOutputHandlers[key]
	memory.__emitted.length = 0
	process.env.memory_ON = "true"
})

afterEach(() => {
	jest.useRealTimers()
	delete process.env.memory_ON
})

describe("convert lock refresh", () => {
	test("the refresh period comfortably undercuts the active-lock threshold", () => {
		expect(EXPORT_LOCK_REFRESH_MS).toBeLessThan(EXPORT_LOCK_ACTIVE_MS)
		expect(EXPORT_LOCK_REFRESH_MS * 2).toBeLessThan(EXPORT_LOCK_ACTIVE_MS)
	})

	test("a video job with no progress events still gets its lock refreshed by the interval", (done) => {
		createVideo({ body: { camera: "1", start: START, end: END } }, {
			send: ({ id }) => {
				const lockPath = path.join(process.env.storage_FOLDERPATH, "shared/captures", exportLockName("mp4", "1", id))
				expect(lockWrites()).toContain(lockPath)
				expect(mockFs.utimes).not.toHaveBeenCalled()

				jest.advanceTimersByTime(EXPORT_LOCK_REFRESH_MS)

				expect(mockFs.utimes).toHaveBeenCalledWith(lockPath, expect.any(Date), expect.any(Date), expect.any(Function))
				done()
			}
		})
	})

	test("a zip job with no progress events still gets its lock refreshed by the interval", async () => {
		let sent
		createZip({ body: { camera: "1", start: START, end: END } }, { send: (body) => { sent = body } })
		await flush()

		const lockPath = path.join(process.env.storage_FOLDERPATH, "shared/captures", exportLockName("zip", "1", sent.id))
		expect(lockWrites()).toContain(lockPath)
		expect(mockFs.utimes).not.toHaveBeenCalled()

		jest.advanceTimersByTime(EXPORT_LOCK_REFRESH_MS)

		expect(mockFs.utimes).toHaveBeenCalledWith(lockPath, expect.any(Date), expect.any(Date), expect.any(Function))
	})

	test("a streaming zip (save:false) also gets its lock refreshed by the interval", async () => {
		createZip({ body: { camera: "1", start: START, end: END, save: false } }, {
			attachment: () => {},
			on: () => {},
			send: () => {}
		})
		await flush()

		const lockPath = zipLockPath()
		expect(lockPath).toBeDefined()
		expect(mockFs.utimes).not.toHaveBeenCalled()

		jest.advanceTimersByTime(EXPORT_LOCK_REFRESH_MS)

		expect(mockFs.utimes).toHaveBeenCalledWith(lockPath, expect.any(Date), expect.any(Date), expect.any(Function))
	})

	test("video progress events no longer touch the lock file directly", (done) => {
		createVideo({ body: { camera: "1", start: START, end: END } }, {
			send: () => {
				mockFfmpegHandlers.progress({ frames: 1 })
				expect(mockFs.utimes).not.toHaveBeenCalled()
				done()
			}
		})
	})

	test("zip no longer registers a progress handler for lock refresh", async () => {
		createZip({ body: { camera: "1", start: START, end: END } }, { send: () => {} })
		await flush()
		expect(mockArchiveHandlers.progress).toBeUndefined()
	})

	test("the refreshed mtime is newer than the orphan-sweep threshold", async () => {
		const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000
		createZip({ body: { camera: "1", start: START, end: END } }, { send: () => {} })
		await flush()

		jest.advanceTimersByTime(EXPORT_LOCK_REFRESH_MS)

		const [, , mtime] = mockFs.utimes.mock.calls[0]
		expect(Date.now() - mtime.getTime()).toBeLessThan(ORPHAN_AGE_MS)
	})

	test("a streaming zip writes a lock before listing frames, so a prune defers on it too", () => {
		let sent
		createZip({ body: { camera: "1", start: START, end: END, save: false } }, {
			attachment: () => {},
			on: () => {},
			send: (body) => { sent = body }
		})

		expect(sent).toBeUndefined()
		expect(lockWrites().filter(p => /zip_.+\.txt$/.test(p))).toHaveLength(1)
	})

	describe("interval cleared on terminal paths, so a finished export cannot keep its lock alive", () => {
		test("stops refreshing the video lock once ffmpeg ends", (done) => {
			createVideo({ body: { camera: "1", start: START, end: END } }, {
				send: () => {
					mockFfmpegHandlers.end()
					mockFs.utimes.mockClear()

					jest.advanceTimersByTime(EXPORT_LOCK_ACTIVE_MS * 2)

					expect(mockFs.utimes).not.toHaveBeenCalled()
					done()
				}
			})
		})

		test("stops refreshing the video lock once ffmpeg errors", (done) => {
			createVideo({ body: { camera: "1", start: START, end: END } }, {
				send: () => {
					mockFfmpegHandlers.error(new Error("ffmpeg exited with code 1"))
					mockFs.utimes.mockClear()

					jest.advanceTimersByTime(EXPORT_LOCK_ACTIVE_MS * 2)

					expect(mockFs.utimes).not.toHaveBeenCalled()
					done()
				}
			})
		})

		test("stops refreshing the video lock once the export is cancelled", (done) => {
			createVideo({ body: { camera: "1", start: START, end: END } }, {
				send: () => {
					cancelEnder()
					mockFs.utimes.mockClear()

					jest.advanceTimersByTime(EXPORT_LOCK_ACTIVE_MS * 2)

					expect(mockFs.utimes).not.toHaveBeenCalled()
					done()
				}
			})
		})

		test("stops refreshing the zip (save) lock once the output stream closes", async () => {
			createZip({ body: { camera: "1", start: START, end: END } }, { send: () => {} })
			await flush()

			mockOutputHandlers.close()
			mockFs.utimes.mockClear()

			jest.advanceTimersByTime(EXPORT_LOCK_ACTIVE_MS * 2)

			expect(mockFs.utimes).not.toHaveBeenCalled()
		})

		test("stops refreshing the zip (save) lock once the archive errors", async () => {
			createZip({ body: { camera: "1", start: START, end: END } }, { send: () => {} })
			await flush()

			mockArchiveHandlers.error(new Error("archive error"))
			mockFs.utimes.mockClear()

			jest.advanceTimersByTime(EXPORT_LOCK_ACTIVE_MS * 2)

			expect(mockFs.utimes).not.toHaveBeenCalled()
		})

		test("stops refreshing the zip (save) lock once the export is cancelled", async () => {
			createZip({ body: { camera: "1", start: START, end: END } }, { send: () => {} })
			await flush()

			cancelEnder()
			mockFs.utimes.mockClear()

			jest.advanceTimersByTime(EXPORT_LOCK_ACTIVE_MS * 2)

			expect(mockFs.utimes).not.toHaveBeenCalled()
		})

		test("stops refreshing the streaming zip lock once the archive errors", async () => {
			let resHandlers = {}
			createZip({ body: { camera: "1", start: START, end: END, save: false } }, {
				attachment: () => {},
				on: (event, cb) => { resHandlers[event] = cb },
				send: () => {},
				headersSent: false,
				status: () => ({ end: () => {} })
			})
			await flush()

			mockArchiveHandlers.error(new Error("archive error"))
			mockFs.utimes.mockClear()

			jest.advanceTimersByTime(EXPORT_LOCK_ACTIVE_MS * 2)

			expect(mockFs.utimes).not.toHaveBeenCalled()
		})

		test("stops refreshing the streaming zip lock once the response closes", async () => {
			let resHandlers = {}
			createZip({ body: { camera: "1", start: START, end: END, save: false } }, {
				attachment: () => {},
				on: (event, cb) => { resHandlers[event] = cb },
				send: () => {}
			})
			await flush()

			resHandlers.close()
			mockFs.utimes.mockClear()

			jest.advanceTimersByTime(EXPORT_LOCK_ACTIVE_MS * 2)

			expect(mockFs.utimes).not.toHaveBeenCalled()
		})
	})
})
