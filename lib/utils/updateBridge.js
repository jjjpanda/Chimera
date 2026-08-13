const path = require("path")

/**
 * Bridge between `command`, which runs inside the container and cannot reach
 * Docker or the host shell, and `chimera/watchdog.js`, which runs on the host.
 * The directory is bind-mounted into the container at the same relative place,
 * so both sides resolve these paths from their own root.
 */
const DIR = path.join(__dirname, "../../chimera-update")

module.exports = {
	DIR,
	REQUEST: path.join(DIR, "request.json"),
	RUNNING: path.join(DIR, "running.json"),
	RESULT: path.join(DIR, "result.json")
}
