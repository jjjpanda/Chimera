const supertest = require("supertest")

jest.mock("lib")
jest.mock("pm2")
jest.mock("memory")
jest.mock("axios")

const spawnWorker = () => {
	let app
	jest.isolateModules(() => {
		app = require("../backend/livestream.js")
	})
	return app
}

const restart = (app, ip) => supertest(app)
	.post("/livestream/restart")
	.set("Cookie", "validCookie")
	.set("X-Forwarded-For", ip)
	.send({ camera: 1 })

describe("Livestream restart cap under cluster mode", () => {
	afterEach(() => {
		delete globalThis.__memoryLoginStore
		delete globalThis.__memoryDisconnected
	})

	test("caps an ip across workers through the shared memory store", async () => {
		const workers = [spawnWorker(), spawnWorker()]

		for(let i = 0; i < 20; i++){
			await restart(workers[i % 2], "10.0.1.1").expect(200)
		}

		for(const worker of workers){
			await restart(worker, "10.0.1.1").expect(429)
		}
		await restart(workers[0], "10.0.1.2").expect(200)
	})

	test("falls back to a per-worker cap when the memory socket is down", async () => {
		globalThis.__memoryDisconnected = true
		const workers = [spawnWorker(), spawnWorker()]

		for(let i = 0; i < 20; i++){
			await restart(workers[0], "10.0.1.3").expect(200)
		}
		await restart(workers[0], "10.0.1.3").expect(429)
		await restart(workers[1], "10.0.1.3").expect(200)
	})
})
