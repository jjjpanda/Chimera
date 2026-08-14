const path = require("path")

/**
 * Bridge between `command`, which runs inside the container and cannot reach
 * Docker or the host shell, and `chimera/watchdog.js`, which runs on the host.
 * The directory is bind-mounted into the container at the same relative place,
 * so both sides resolve these paths from their own root.
 */
const DIR = process.env.CHIMERA_UPDATE_DIR || path.join(__dirname, "../../chimera-update")

const parts = (version) => String(version ?? "").split(".").map(n => Number.parseInt(n, 10))

/**
 * `"major" | "minor" | "patch" | "none"`, or null when either version is
 * unknown or not three numbers. The watchdog refuses a major without
 * `allowMajor` and the panel warns before asking for one — both read it here,
 * so the gate and the warning can never disagree.
 */
const bumpKind = ({ current, available } = {}) => {
	const [fromMajor, fromMinor, fromPatch] = parts(current)
	const [toMajor, toMinor, toPatch] = parts(available)
	if ([fromMajor, fromMinor, fromPatch, toMajor, toMinor, toPatch].some(n => !Number.isInteger(n))) return null
	if (fromMajor !== toMajor) return "major"
	if (fromMinor !== toMinor) return "minor"
	return fromPatch === toPatch ? "none" : "patch"
}

const majorBump = (versions) => bumpKind(versions) === "major"

module.exports = {
	DIR,
	REQUEST: path.join(DIR, "request.json"),
	RUNNING: path.join(DIR, "running.json"),
	RESULT: path.join(DIR, "result.json"),
	VERSION: path.join(DIR, "version.json"),
	bumpKind,
	majorBump
}
