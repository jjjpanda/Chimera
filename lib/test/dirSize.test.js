const fs = require("fs")
const os = require("os")
const path = require("path")
const getDirectorySize = require("../utils/dirSize.js")

describe("getDirectorySize", () => {
	let dir

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "dirsize-test-"))
	})

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true })
	})

	test("returns 0 for an empty directory", async () => {
		expect(await getDirectorySize(dir)).toBe(0)
	})

	test("sums file sizes in a flat directory", async () => {
		fs.writeFileSync(path.join(dir, "a.txt"), "a".repeat(10))
		fs.writeFileSync(path.join(dir, "b.txt"), "b".repeat(25))
		expect(await getDirectorySize(dir)).toBe(35)
	})

	test("recurses into subdirectories", async () => {
		const sub = path.join(dir, "sub")
		fs.mkdirSync(sub)
		fs.writeFileSync(path.join(dir, "top.txt"), "x".repeat(5))
		fs.writeFileSync(path.join(sub, "nested.txt"), "y".repeat(15))
		expect(await getDirectorySize(dir)).toBe(20)
	})

	test("returns 0 for a directory that doesn't exist", async () => {
		expect(await getDirectorySize(path.join(dir, "missing"))).toBe(0)
	})

	test("treats an unreadable file as size 0 instead of throwing", async () => {
		fs.writeFileSync(path.join(dir, "ok.txt"), "z".repeat(10))
		const statSpy = jest.spyOn(fs.promises, "stat").mockImplementation((target) => {
			if (String(target).endsWith("ok.txt")) return Promise.reject(new Error("stat failed"))
			return jest.requireActual("fs").promises.stat(target)
		})

		expect(await getDirectorySize(dir)).toBe(0)

		statSpy.mockRestore()
	})
})
