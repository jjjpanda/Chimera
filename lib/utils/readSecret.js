const fs = require("fs")

module.exports = (name) => {
	const file = process.env[`${name}_FILE`]
	if (!file) return process.env[name]
	try {
		return fs.readFileSync(file, "utf8").trim()
	} catch (e) {
		console.error(`${name}_FILE is unreadable (${e.code}): ${file} — the container reads it as uid 1000, so fix the source file on the host: \`sudo chown 1000:1000 secrets/${name} && sudo chmod 440 secrets/${name}\` (see secrets/README.md step 1)`)
		return undefined
	}
}
