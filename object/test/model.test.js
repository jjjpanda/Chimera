const fs = require("fs")
const crypto = require("crypto")
const { PassThrough } = require("stream")

jest.mock("fs")
global.fetch = jest.fn()

const { ensureModel, MODEL_PATH } = require("../backend/lib/model.js")

describe("ensureModel", () => {
	const originalEnv = process.env
	
	beforeEach(() => {
		jest.resetAllMocks()
		process.env = { ...originalEnv }
		delete process.env.object_MODEL_URL
		delete process.env.object_MODEL_SHA256
		
		fs.mkdirSync.mockImplementation(() => {})
		fs.writeFileSync.mockImplementation(() => {})
	})
	
	afterAll(() => {
		process.env = originalEnv
	})

	const mockFetch = (buffer, ok = true, status = 200) => {
		fetch.mockResolvedValueOnce({
			ok,
			status,
			arrayBuffer: () => Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
		})
	}

	const mockReadStream = (data) => {
		fs.createReadStream.mockImplementationOnce(() => {
			const stream = new PassThrough()
			stream.end(data)
			return stream
		})
	}

	test("returns existing file if SHA matches", async () => {
		fs.existsSync.mockReturnValue(true)
		const buffer = Buffer.from("existing data")
		const hash = crypto.createHash("sha256").update(buffer).digest("hex")
		process.env.object_MODEL_SHA256 = hash
		
		mockReadStream(buffer)
		
		const result = await ensureModel()
		expect(result).toBe(MODEL_PATH)
		expect(fetch).not.toHaveBeenCalled()
	})

	test("redownloads and unlinks if existing file is unreadable/corrupt", async () => {
		fs.existsSync.mockReturnValue(true)
		fs.createReadStream.mockImplementationOnce(() => {
			const stream = new PassThrough()
			stream.emit("error", new Error("corrupt"))
			return stream
		})
		const goodBuffer = Buffer.from("good data")
		process.env.object_MODEL_SHA256 = crypto.createHash("sha256").update(goodBuffer).digest("hex")
		mockFetch(goodBuffer)

		const result = await ensureModel()
		expect(result).toBe(MODEL_PATH)
		expect(fs.unlinkSync).toHaveBeenCalledWith(MODEL_PATH)
		expect(fetch).toHaveBeenCalled()
		expect(fs.writeFileSync).toHaveBeenCalledWith(MODEL_PATH, expect.any(Buffer))
	})

	test("redownloads if existing file fails SHA check", async () => {
		fs.existsSync.mockReturnValue(true)
		const badBuffer = Buffer.from("bad data")
		mockReadStream(badBuffer)
		
		const goodBuffer = Buffer.from("good data")
		process.env.object_MODEL_SHA256 = crypto.createHash("sha256").update(goodBuffer).digest("hex")
		mockFetch(goodBuffer)
		
		const result = await ensureModel()
		expect(result).toBe(MODEL_PATH)
		expect(fetch).toHaveBeenCalled()
		expect(fs.writeFileSync).toHaveBeenCalledWith(MODEL_PATH, expect.any(Buffer))
	})

	test("throws error if downloaded file fails SHA check", async () => {
		fs.existsSync.mockReturnValue(false)
		const buffer = Buffer.from("bad download data")
		process.env.object_MODEL_SHA256 = "expectedhash"
		
		mockFetch(buffer)
		
		await expect(ensureModel()).rejects.toThrow("downloaded model failed SHA256 integrity check")
	})

	test("throws if custom URL provided without SHA256", async () => {
		fs.existsSync.mockReturnValue(false)
		process.env.object_MODEL_URL = "http://custom.url"

		await expect(ensureModel()).rejects.toThrow("object_MODEL_URL requires object_MODEL_SHA256")
		expect(fetch).not.toHaveBeenCalled()
	})

	test("downloads from custom URL and verifies SHA256", async () => {
		fs.existsSync.mockReturnValue(false)
		const goodBuffer = Buffer.from("custom model data")
		process.env.object_MODEL_URL = "http://custom.url"
		process.env.object_MODEL_SHA256 = crypto.createHash("sha256").update(goodBuffer).digest("hex")
		mockFetch(goodBuffer)

		const result = await ensureModel()
		expect(result).toBe(MODEL_PATH)
		expect(fetch).toHaveBeenCalledWith("http://custom.url", expect.objectContaining({ signal: expect.anything() }))
		expect(fs.writeFileSync).toHaveBeenCalledWith(MODEL_PATH, expect.any(Buffer))
	})

	test("throws error if fetch fails with HTTP error", async () => {
		fs.existsSync.mockReturnValue(false)
		mockFetch(Buffer.from(""), false, 404)
		
		await expect(ensureModel()).rejects.toThrow("model download failed: 404")
	})

	test("default path: returns existing file if it matches DEFAULT_SHA256", async () => {
		fs.existsSync.mockReturnValue(true)
		const buffer = Buffer.from("default data")
		
		const mockHash = {
			update: jest.fn().mockReturnThis(),
			digest: jest.fn().mockReturnValue("427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7")
		}
		jest.spyOn(crypto, "createHash").mockReturnValue(mockHash)
		
		mockReadStream(buffer)
		
		const result = await ensureModel()
		expect(result).toBe(MODEL_PATH)
		expect(fetch).not.toHaveBeenCalled()
		
		crypto.createHash.mockRestore()
	})

	test("default path: redownloads from DEFAULT_URL if existing file fails DEFAULT_SHA256 check", async () => {
		fs.existsSync.mockReturnValue(true)
		const badBuffer = Buffer.from("bad data")
		mockReadStream(badBuffer)
		
		const goodBuffer = Buffer.from("good data")
		mockFetch(goodBuffer)
		
		const mockHashBad = {
			update: jest.fn().mockReturnThis(),
			digest: jest.fn().mockReturnValue("badhash")
		}
		const mockHashGood = {
			update: jest.fn().mockReturnThis(),
			digest: jest.fn().mockReturnValue("427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7")
		}
		jest.spyOn(crypto, "createHash")
			.mockReturnValueOnce(mockHashBad)
			.mockReturnValueOnce(mockHashGood)
			
		const result = await ensureModel()
		expect(result).toBe(MODEL_PATH)
		expect(fetch).toHaveBeenCalledWith("https://github.com/jjjpanda/Chimera/releases/download/v6_resources/yolox_tiny.onnx", expect.objectContaining({ signal: expect.anything() }))
		expect(fs.writeFileSync).toHaveBeenCalledWith(MODEL_PATH, expect.any(Buffer))
		
		crypto.createHash.mockRestore()
	})
})
