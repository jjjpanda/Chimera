const fs = require("fs")

jest.mock("lib")
jest.mock("memory")
jest.mock("pm2")

describe("Storage startup", () => {
	beforeEach(() => {
		jest.resetModules()
	})

	test("cleans up orphaned locks and corresponding files older than 24h", (done) => {
		jest.doMock("fs", () => {
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
						"mp4_old_orphan.txt",
						"output_1_start_end_old_orphan.mp4",
						"zip_new_orphan.txt",
						"output_1_start_end_new_orphan.zip",
						"mp4_error_orphan.txt"
					])
				})
			}
		})

		const mockFs = require("fs")
		require("../backend/storage.js")

		setTimeout(() => {
			try {
				expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining("mp4_old_orphan.txt"), expect.any(Function))
				expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining("output_1_start_end_old_orphan.mp4"), expect.any(Function))
				expect(mockFs.unlink).not.toHaveBeenCalledWith(expect.stringContaining("zip_new_orphan.txt"), expect.any(Function))
				expect(mockFs.unlink).not.toHaveBeenCalledWith(expect.stringContaining("output_1_start_end_new_orphan.zip"), expect.any(Function))
				expect(mockFs.unlink).not.toHaveBeenCalledWith(expect.stringContaining("mp4_error_orphan.txt"), expect.any(Function))
				done()
			} catch(e) {
				done(e)
			}
		}, 100)
	})
})
