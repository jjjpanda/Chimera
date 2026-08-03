const supertest = require("supertest")
const fs = require("fs")
const path = require("path")
const app = require("../backend/command.js")

jest.mock("memory")
jest.mock("fs", () => jest.requireActual("fs"))

const distDir = path.join(__dirname, "../dist")
const indexFile = path.join(distDir, "index.html")
let createdDir = false
let createdIndex = false

beforeAll(() => {
	if (!fs.existsSync(distDir)) { fs.mkdirSync(distDir, { recursive: true }); createdDir = true }
	if (!fs.existsSync(indexFile)) { fs.writeFileSync(indexFile, "<!doctype html><title>test</title>"); createdIndex = true }
})

afterAll(() => {
	if (createdIndex) fs.rmSync(indexFile)
	if (createdDir) fs.rmSync(distDir, { recursive: true, force: true })
})

describe("Web App Routes", () => {
	const webAppRoutes = app.webAppRoutes.map(route => route.endsWith("/") ? route : `${route}/`)

	test("Web app routes respond with 200", () =>
		Promise.all(webAppRoutes.map(route => new Promise((resolve, reject) => {
			supertest(app)
				.get(route)
				.expect(200, (err) => err ? reject(new Error(`route ${route} failed`)) : resolve())
		})))
	)

	test("/account/ responds with 200", (done) => {
		supertest(app)
			.get("/account/")
			.expect(200, done)
	})

	test("Nonexistent route responds with 404", (done) => {
		supertest(app)
			.get("/this/is/not/a/route/nor/will/it/ever/be")
			.expect(404, done)
	})
})
