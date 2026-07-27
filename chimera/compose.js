const { spawnSync } = require("child_process")
const { readLines, getVal } = require("./preflight.js")

const composeArgs = (lines, args = []) =>
	args[0] === "up" && getVal(lines, "certbot_ON") !== "true" ? [...args, "--scale", "certbot=0"] : args

if (require.main === module) {
	const { status, error } = spawnSync("docker", ["compose", ...composeArgs(readLines(), process.argv.slice(2))], {
		stdio: "inherit",
		shell: process.platform === "win32"
	})
	if (error) console.error(error.message)
	process.exit(status ?? 1)
}

module.exports = { composeArgs }
