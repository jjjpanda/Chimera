const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const helmetOptions = require("../utils/helmetOptions.js")

describe("helmetOptions", () => {
	test("script-src pins the sha256 of every inline script in index.html", () => {
		const html = fs.readFileSync(path.join(__dirname, "../../command/frontend/index.html"), "utf8")
		const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1])

		expect(inline.length).toBeGreaterThan(0)
		for (const script of inline) {
			const hash = `'sha256-${crypto.createHash("sha256").update(script, "utf8").digest("base64")}'`
			expect(helmetOptions.contentSecurityPolicy.directives["script-src"]).toContain(hash)
		}
	})
})
