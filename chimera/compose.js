const { spawnSync } = require("child_process")
const { readLines, getVal } = require("./preflight.js")

const composeArgs = (lines, args = []) =>
	args[0] === "up" && getVal(lines, "certbot_ON") !== "true" ? [...args, "--scale", "certbot=0"] : args

const composeCommand = (args) => ["docker", "compose", ...composeArgs(readLines(), args)]

const runCompose = (args) => {
	const [cmd, ...rest] = composeCommand(args)
	return spawnSync(cmd, rest, {
		stdio: "inherit",
		shell: process.platform === "win32"
	})
}

if (require.main === module) {
	const { status, error } = runCompose(process.argv.slice(2))
	if (error) console.error(error.message)
	process.exit(status ?? 1)
}

module.exports = { composeArgs, composeCommand, runCompose }
