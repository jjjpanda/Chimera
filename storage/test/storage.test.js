jest.mock("lib")
jest.mock("memory")
jest.mock("pm2")

describe("Storage startup", () => {
	const mockSweepableFs = () => jest.doMock("fs", () => {
		const actual = jest.requireActual("fs")
		return {
			...actual,
			unlink: jest.fn((path, cb) => {
				if (cb) cb(null)
			}),
			statSync: jest.fn((path) => {
				if (path.includes("old_orphan")) return { mtimeMs: Date.now() - 48 * 60 * 60 * 1000 }
				if (path.includes("new_orphan")) return { mtimeMs: Date.now() }
				if (path.includes("error_orphan")) throw new Error("stat error")
				return { mtimeMs: Date.now() }
			}),
			readdir: jest.fn((path, cb) => {
				cb(null, [
					"mp4_1_old_orphan.txt",
					"output_1_start_end_old_orphan.mp4",
					"zip_1_new_orphan.txt",
					"output_1_start_end_new_orphan.zip",
					"mp4_1_error_orphan.txt"
				])
			})
		}
	})

	beforeEach(() => {
		jest.resetModules()
	})

	test("cleans up orphaned locks and corresponding files older than 24h", (done) => {
		mockSweepableFs()

		const mockFs = require("fs")
		require("../backend/storage.js")

		setTimeout(() => {
			try {
				expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining("mp4_1_old_orphan.txt"), expect.any(Function))
				expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining("output_1_start_end_old_orphan.mp4"), expect.any(Function))
				expect(mockFs.unlink).not.toHaveBeenCalledWith(expect.stringContaining("zip_1_new_orphan.txt"), expect.any(Function))
				expect(mockFs.unlink).not.toHaveBeenCalledWith(expect.stringContaining("output_1_start_end_new_orphan.zip"), expect.any(Function))
				expect(mockFs.unlink).not.toHaveBeenCalledWith(expect.stringContaining("mp4_1_error_orphan.txt"), expect.any(Function))
				done()
			} catch(e) {
				done(e)
			}
		}, 100)
	})

	test("keeps sweeping on an interval, not only at boot", () => {
		jest.useFakeTimers()
		mockSweepableFs()

		const mockFs = require("fs")
		require("../backend/storage.js")

		expect(mockFs.readdir).toHaveBeenCalledTimes(1)
		mockFs.unlink.mockClear()

		jest.advanceTimersByTime(30 * 60 * 1000)

		expect(mockFs.readdir).toHaveBeenCalledTimes(2)
		expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining("mp4_1_old_orphan.txt"), expect.any(Function))

		jest.useRealTimers()
	})

	test("reclaims untracked frames on its own hourly schedule, at boot and on the interval", () => {
		jest.useFakeTimers()
		mockSweepableFs()

		const file = require("../backend/routes/lib/file.js")
		const sweep = jest.spyOn(file, "sweepOrphanFrames").mockResolvedValue(0)
		require("../backend/storage.js")

		expect(sweep).toHaveBeenCalledTimes(1)

		jest.advanceTimersByTime(60 * 60 * 1000)
		expect(sweep).toHaveBeenCalledTimes(2)

		sweep.mockRestore()
		jest.useRealTimers()
	})
})
