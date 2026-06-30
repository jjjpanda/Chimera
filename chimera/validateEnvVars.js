require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { parseSchema } = require("./preflight.js")

let allEnvPresent = true
const optionalKeys = new Set(parseSchema().filter(v => v.optional).map(v => v.key))

const checkVar = (varName) => {
	if (optionalKeys.has(varName)) return true
	const val = process.env[varName]
	if (val != null && val.trim() !== "") return true
	console.log("MISSING ENV VAR", varName)
	allEnvPresent = false
	return false
}

const isFolderCheck = (varName) => {
	try {
		return fs.lstatSync(process.env[varName]).isDirectory()
	}
	catch(e) {
		return false
	}
}

const confirmPath = (varName, shouldBeFolder=false) => {
	if(process.env[varName] == null || process.env[varName].length == 0){
		return
	}
	const isAbsolutePath =  path.isAbsolute(process.env[varName])
	if(!isAbsolutePath){
		console.log(varName, "SHOULD BE AN ABSOLUTE PATH")
		allEnvPresent = false
		return
	}
	const isFolder = isFolderCheck(varName)
	if(shouldBeFolder && !isFolder){
		console.log(varName, "SHOULD BE A FOLDER")
		allEnvPresent = false
		return
	}
	if(!shouldBeFolder && isFolder){
		console.log(varName, "SHOULD BE A FILE")
		allEnvPresent = false
		return
	}
	return
}

checkVar("NODE_ENV")
checkVar("chimeraInstances")

checkVar("storage_MAX_GB")
checkVar("alert_URL")
checkVar("admin_alert_URL")
checkVar("PRINTPASSWORD")
checkVar("SECRETKEY")

checkVar("command_PROXY_ON")
checkVar("schedule_PROXY_ON")
checkVar("storage_PROXY_ON")
checkVar("livestream_PROXY_ON")
checkVar("object_PROXY_ON")
checkVar("gateway_ON")
checkVar("gateway_PORT")
checkVar("gateway_HOST")
checkVar("gateway_PORT_SECURE")

checkVar("privateKey_FILEPATH")
confirmPath("privateKey_FILEPATH")

checkVar("certificate_FILEPATH")
confirmPath("certificate_FILEPATH")

checkVar("gateway_HTTPS_Redirect")
checkVar("command_ON")
checkVar("command_PORT")
checkVar("command_HOST")

checkVar("schedule_ON")
checkVar("schedule_PORT")
checkVar("schedule_HOST")
checkVar("scheduler_AUTH")

checkVar("storage_ON")
checkVar("storage_PORT")
checkVar("storage_HOST")
checkVar("storage_FOLDERPATH")
confirmPath("storage_FOLDERPATH", true)

checkVar("storage_MOTION_CONF_FILEPATH")

checkVar("ffmpeg_FILEPATH")
confirmPath("ffmpeg_FILEPATH")

checkVar("ffprobe_FILEPATH")
confirmPath("ffprobe_FILEPATH")

checkVar("livestream_ON")
checkVar("livestream_PORT")
checkVar("livestream_HOST")
checkVar("livestream_FOLDERPATH")
confirmPath("livestream_FOLDERPATH", true)

checkVar("object_ON")
checkVar("object_PORT")
checkVar("object_CONFIDENCE")
checkVar("object_INTERVAL_MS")
checkVar("object_MODEL_URL")
checkVar("object_INPUT_SIZE")
checkVar("object_ALERT_ON")
checkVar("object_MAX_CAPTURES")

checkVar("memory_ON")
checkVar("memory_PORT")
checkVar("memory_HOST")
checkVar("memory_AUTH_TOKEN")

checkVar("database_NAME")
checkVar("database_USER")
checkVar("database_PASSWORD")
checkVar("database_HOST")
checkVar("database_PORT")
if(allEnvPresent){
	process.exit(0)
}
else{
	process.exit(1)
}
