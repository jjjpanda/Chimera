jest.mock("lib")
jest.mock("pm2")
jest.mock("memory")
jest.mock("axios")

describe("Livestream startup", () => {
	const originalEnv = process.env

	beforeEach(() => {
		jest.resetModules()
		process.env = { ...originalEnv, livestream_FOLDERPATH: "/mnt/storage" }
	})

	afterAll(() => {
		process.env = originalEnv
	})

	test("creates a feed directory per camera when livestream_ON=true", async () => {
		process.env.livestream_ON = "true"

		jest.doMock("fs", () => {
			const actual = jest.requireActual("fs")
			return { ...actual, mkdirSync: jest.fn() }
		})
		jest.doMock("lib", () => {
			const lib = jest.requireActual("../__mocks__/lib.js")
			lib.loadCameras.mockResolvedValue([{ id: 1 }, { id: 2 }])
			return lib
		})

		const fs = require("fs")
		const path = require("path")
		require("../backend/livestream.js")

		await new Promise(resolve => setTimeout(resolve, 0))

		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join("/mnt/storage", "feed", "1"), { recursive: true })
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join("/mnt/storage", "feed", "2"), { recursive: true })
	})

	test("does not touch the filesystem when livestream_ON=false, even with cameras configured", async () => {
		process.env.livestream_ON = "false"

		jest.doMock("fs", () => {
			const actual = jest.requireActual("fs")
			return { ...actual, mkdirSync: jest.fn() }
		})
		jest.doMock("lib", () => {
			const lib = jest.requireActual("../__mocks__/lib.js")
			lib.loadCameras.mockResolvedValue([{ id: 1 }, { id: 2 }])
			return lib
		})

		const fs = require("fs")
		require("../backend/livestream.js")
		
		await new Promise(resolve => setTimeout(resolve, 0))

		expect(fs.mkdirSync).not.toHaveBeenCalled()
	})
})
