const path = require("path")

/**
 * Bridge between `command`, which runs inside the container and cannot reach
 * Docker or the host shell, and `chimera/watchdog.js`, which runs on the host.
 * The directory is bind-mounted into the container at the same relative place,
 * so both sides resolve these paths from their own root.
 */
const DIR = process.env.CHIMERA_UPDATE_DIR || path.join(__dirname, "../../chimera-update")

const parts = (version) => String(version ?? "").split(".").map(n => Number.parseInt(n, 10))

const bumpKind = ({ current, available } = {}) => {
	const [fromMajor, fromMinor, fromPatch] = parts(current)
	const [toMajor, toMinor, toPatch] = parts(available)
	if ([fromMajor, fromMinor, fromPatch, toMajor, toMinor, toPatch].some(n => !Number.isInteger(n))) return null
	if (fromMajor !== toMajor) return "major"
	if (fromMinor !== toMinor) return "minor"
	return fromPatch === toPatch ? "none" : "patch"
}

const majorBump = (versions) => bumpKind(versions) === "major"

const HEARTBEAT = path.join(DIR, "heartbeat.json")
const HEARTBEAT_MAX_AGE_MS = 120000

module.exports = {
	DIR,
	REQUEST: path.join(DIR, "request.json"),
	RUNNING: path.join(DIR, "running.json"),
	RESULT: path.join(DIR, "result.json"),
	VERSION: path.join(DIR, "version.json"),
	HEARTBEAT,
	HEARTBEAT_MAX_AGE_MS,
	bumpKind,
	majorBump
}
