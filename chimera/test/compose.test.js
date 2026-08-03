const { composeArgs } = require("../compose.js")

const lines = (env) => Object.entries(env).map(([k, v]) => `${k} = ${v}`)

describe("composeArgs", () => {
	test("certbot_ON=true leaves up alone, so the certbot container starts", () => {
		expect(composeArgs(lines({ certbot_ON: "true" }), ["up", "-d"])).toEqual(["up", "-d"])
	})

	test("certbot_ON=false scales certbot to 0, so no idle container runs and an already-running one is removed", () => {
		expect(composeArgs(lines({ certbot_ON: "false" }), ["up", "-d"])).toEqual(["up", "-d", "--scale", "certbot=0"])
	})

	test("an unset certbot_ON counts as off", () => {
		expect(composeArgs([], ["up", "-d"])).toEqual(["up", "-d", "--scale", "certbot=0"])
	})

	test("other commands pass through untouched — --scale is only valid on up", () => {
		expect(composeArgs(lines({ certbot_ON: "false" }), ["down"])).toEqual(["down"])
		expect(composeArgs(lines({ certbot_ON: "false" }), ["logs", "-f"])).toEqual(["logs", "-f"])
	})
})

// docker:restart is the documented add-a-camera step, so it needs the same gate as build and up
describe("preflight hooks", () => {
	const { scripts } = require("../../package.json")

	test.each(["docker:build", "docker:up", "docker:restart"])("%s runs the check first", (script) => {
		expect(scripts[`pre${script}`]).toBe("node chimera/preflight.js --check")
	})
})
