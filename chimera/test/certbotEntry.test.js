const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

const SCRIPT = path.join(__dirname, "..", "..", "certbot-entry.sh")

const tmp = []

const grantGatewayRead = (dir, domain) => {
	const fn = fs.readFileSync(SCRIPT, "utf8").match(/grant_gateway_read\(\) \{[\s\S]*?\n\}/)
	expect(fn).not.toBeNull()
	const bin = fs.mkdtempSync(path.join(os.tmpdir(), "stubbin-"))
	const log = path.join(bin, "calls")
	fs.writeFileSync(path.join(bin, "chgrp"), `#!/bin/sh\necho "$@" >> "${log}"\n`, { mode: 0o755 })
	tmp.push(bin)
	const res = spawnSync("sh", ["-c", `${fn[0]}\ngrant_gateway_read`], {
		env: { PATH: `${bin}:${process.env.PATH}`, LE_DIR: dir, DOMAIN: domain },
		encoding: "utf8"
	})
	expect(res.status).toBe(0)
	return fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : []
}

const mode = (...parts) => fs.statSync(path.join(...parts)).mode & 0o777

const store = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "letsencrypt-"))
	tmp.push(dir)
	for (const parent of ["live", "archive"]) {
		fs.mkdirSync(path.join(dir, parent), { mode: 0o700 })
		for (const lineage of ["mine.com", "other.com"]) {
			fs.mkdirSync(path.join(dir, parent, lineage), { mode: 0o700 })
			fs.writeFileSync(path.join(dir, parent, lineage, "privkey.pem"), "key", { mode: 0o600 })
		}
	}
	return dir
}

afterEach(() => {
	while (tmp.length) fs.rmSync(tmp.pop(), { recursive: true, force: true })
})

describe("grant_gateway_read", () => {
	test("opens up only the configured domain's lineage, leaving other certs in the shared store untouched", () => {
		const dir = store()

		grantGatewayRead(dir, "mine.com")

		expect(mode(dir, "live", "mine.com", "privkey.pem") & 0o040).toBe(0o040)
		expect(mode(dir, "archive", "mine.com", "privkey.pem") & 0o040).toBe(0o040)
		expect(mode(dir, "live", "mine.com") & 0o050).toBe(0o050)
		expect(mode(dir, "archive", "mine.com") & 0o050).toBe(0o050)

		expect(mode(dir, "live", "other.com", "privkey.pem")).toBe(0o600)
		expect(mode(dir, "archive", "other.com", "privkey.pem")).toBe(0o600)
		expect(mode(dir, "live", "other.com")).toBe(0o700)
		expect(mode(dir, "archive", "other.com")).toBe(0o700)
	})

	test("grants the store parents traverse but not read, so the gateway cannot list what other certs exist", () => {
		const dir = store()

		grantGatewayRead(dir, "mine.com")

		expect(mode(dir, "live")).toBe(0o710)
		expect(mode(dir, "archive")).toBe(0o710)
	})

	test("recurses group ownership only inside the configured lineage, never over the store root", () => {
		const dir = store()

		expect(grantGatewayRead(dir, "mine.com")).toEqual([
			`1000 ${dir}/live ${dir}/archive`,
			`-R 1000 ${dir}/live/mine.com ${dir}/archive/mine.com`
		])
	})

	test("is a no-op without a domain — an install that owns no cert relaxes nothing", () => {
		const dir = store()

		expect(grantGatewayRead(dir, "")).toEqual([])

		expect(mode(dir, "live")).toBe(0o700)
		expect(mode(dir, "archive")).toBe(0o700)
		expect(mode(dir, "live", "mine.com", "privkey.pem")).toBe(0o600)
		expect(mode(dir, "live", "other.com", "privkey.pem")).toBe(0o600)
	})
})
