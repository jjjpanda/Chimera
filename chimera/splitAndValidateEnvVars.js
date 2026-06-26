require("dotenv").config()
const fs = require("fs")
const path = require("path")

let env = {
	command: "",
	gateway: "",
	lib: "",
	livestream: "",
	memory: "",
	object: "",
	schedule: "",
	storage: ""
}

let allEnvPresent = true

const writeVarLine = (varName) => {
	if(varName in process.env){
		return `${varName} = ${process.env[varName]}\n`
	}
	else{
		console.log("MISSING ENV VAR", varName)
		allEnvPresent = false
	}
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
	if(process.env[varName].length == 0){
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

env.command += writeVarLine("NODE_ENV")

writeVarLine("chimeraInstances")

env.storage += writeVarLine("storage_MAX_GB")
env.schedule += writeVarLine("storage_MAX_GB")

env.lib += writeVarLine("alert_URL")
env.object += writeVarLine("alert_URL")
env.lib += writeVarLine("admin_alert_URL")
env.storage += writeVarLine("admin_alert_URL")

env.lib += writeVarLine("PRINTPASSWORD")

env.command += writeVarLine("SECRETKEY")
env.lib += writeVarLine("SECRETKEY")
env.object += writeVarLine("SECRETKEY")

env.gateway += writeVarLine("command_PROXY_ON")
env.gateway += writeVarLine("schedule_PROXY_ON")
env.gateway += writeVarLine("storage_PROXY_ON")
env.gateway += writeVarLine("livestream_PROXY_ON")
env.gateway += writeVarLine("object_PROXY_ON")
env.gateway += writeVarLine("gateway_ON")
env.gateway += writeVarLine("gateway_PORT")

env.command += writeVarLine("gateway_HOST")
env.schedule += writeVarLine("gateway_HOST")
env.storage += writeVarLine("gateway_HOST")

env.gateway += writeVarLine("gateway_PORT_SECURE")

env.lib += writeVarLine("privateKey_FILEPATH")
confirmPath("privateKey_FILEPATH")

env.lib += writeVarLine("certificate_FILEPATH")
confirmPath("certificate_FILEPATH")

env.gateway += writeVarLine("gateway_HTTPS_Redirect")

env.command += writeVarLine("command_ON")

env.command += writeVarLine("command_PORT")

env.gateway += writeVarLine("command_HOST")

env.schedule += writeVarLine("schedule_ON")
env.schedule += writeVarLine("schedule_PORT")

env.gateway += writeVarLine("schedule_HOST")

env.gateway += writeVarLine("object_HOST")

env.lib += writeVarLine("scheduler_AUTH")
env.schedule += writeVarLine("scheduler_AUTH")

env.storage += writeVarLine("storage_ON")
env.storage += writeVarLine("storage_PORT")

env.gateway += writeVarLine("storage_HOST")

env.storage += writeVarLine("storage_FOLDERPATH")
confirmPath("storage_FOLDERPATH", true)

env.storage += writeVarLine("storage_MOTION_CONF_FILEPATH")
env.command += writeVarLine("storage_MOTION_CONF_FILEPATH")
env.object += writeVarLine("storage_MOTION_CONF_FILEPATH")

env.storage += writeVarLine("ffmpeg_FILEPATH")
env.object += writeVarLine("ffmpeg_FILEPATH")
confirmPath("ffmpeg_FILEPATH")

env.storage += writeVarLine("ffprobe_FILEPATH")
confirmPath("ffprobe_FILEPATH")

env.livestream += writeVarLine("livestream_ON")
env.livestream += writeVarLine("livestream_PORT")

env.gateway += writeVarLine("livestream_HOST")

env.livestream += writeVarLine("livestream_FOLDERPATH")
env.object += writeVarLine("livestream_FOLDERPATH")
confirmPath("livestream_FOLDERPATH", true)

env.object += writeVarLine("object_ON")
env.object += writeVarLine("object_PORT")
env.object += writeVarLine("object_CONFIDENCE")
env.object += writeVarLine("object_INTERVAL_MS")
env.object += writeVarLine("object_MODEL_URL")
env.object += writeVarLine("object_INPUT_SIZE")
env.object += writeVarLine("object_ALERT_ON")
env.object += writeVarLine("object_MAX_CAPTURES")

env.memory += writeVarLine("memory_ON")
env.memory += writeVarLine("memory_PORT")
env.memory += writeVarLine("memory_HOST")
env.memory += writeVarLine("memory_AUTH_TOKEN")

env.storage += writeVarLine("database_NAME")
env.command += writeVarLine("database_NAME")
env.schedule += writeVarLine("database_NAME")
env.object += writeVarLine("database_NAME")

env.storage += writeVarLine("database_USER")
env.command += writeVarLine("database_USER")
env.schedule += writeVarLine("database_USER")
env.object += writeVarLine("database_USER")

env.storage += writeVarLine("database_PASSWORD")
env.command += writeVarLine("database_PASSWORD")
env.schedule += writeVarLine("database_PASSWORD")
env.object += writeVarLine("database_PASSWORD")

env.storage += writeVarLine("database_HOST")
env.command += writeVarLine("database_HOST")
env.schedule += writeVarLine("database_HOST")
env.object += writeVarLine("database_HOST")

env.storage += writeVarLine("database_PORT")
env.command += writeVarLine("database_PORT")
env.schedule += writeVarLine("database_PORT")
env.object += writeVarLine("database_PORT")

if(allEnvPresent){
	Promise.all(Object.entries(env)
		.map(([key, value]) => new Promise((resolve, reject) => {
			fs.writeFile(`${key}/.env`, value, (err) => {
				if(!err) resolve()
				else reject()
			})
		}))
	).then(() => {
		process.exit(0)
	}, () => {
		process.exit(1)
	})
}
else{
	process.exit(1)
}

