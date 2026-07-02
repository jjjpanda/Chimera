require("dotenv").config()
module.exports = {
	webhookAlert: require("./utils/webhookAlert.js"),
	alertTime: require("./utils/alertTime.js"),
	auth: require("./utils/auth.js"),
	tracker: require("./utils/tracker.js"),
	handleServerStart: require("./utils/handleServerStart.js"),
	handleSecureServerStart: require("./utils/handleSecureServerStart.js"),
	validateBody: require("./utils/validateBody.js"),
	password: require("./utils/password.json"),
	subprocess: require("./utils/subprocess.js"),
	formatBytes: require("./utils/formatBytes.js"),
	tempMiddleware: require("./utils/tempMiddleware.js"),
	jsonFileHanding: require("./utils/jsonFileHandling.js"),
	randomID: require("./utils/randomID.js"),
	helmetOptions: require("./utils/helmetOptions.js"),
	loadCameras: require("./utils/loadCameras.js").loadCameras,
	objectState: require("./utils/objectState.js"),
	pruneInterval: require("./utils/pruneInterval.js"),
	isPrimeInstance: !("NODE_APP_INSTANCE" in process.env) || process.env.NODE_APP_INSTANCE === "0"
}