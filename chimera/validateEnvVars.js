require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { parseSchema, isServiceOff, typeOf } = require("./preflight.js")
const multiInstance = require("../lib/utils/multiInstance.js")

let allEnvPresent = true
const schema = parseSchema()
const optionalKeys = new Set(schema.filter(v => v.optional).map(v => v.key))
const placeholders = new Map(schema.map(v => [v.key, v.placeholder]))
const isSecret = (key) => /^SECRETKEY$|_(AUTH|TOKEN|PASSWORD)$/.test(key)

const instances = (process.env.chimeraInstances || "").trim()
if (instances !== "" && instances !== "max" && !/^-?\d+$/.test(instances)) {
	console.log("chimeraInstances MUST BE AN INTEGER OR \"max\"")
	allEnvPresent = false
}

const envLines = Object.entries(process.env).map(([k, v]) => `${k} = ${v}`)

const checkVar = (varName) => {
	if (optionalKeys.has(varName) || isServiceOff(envLines, varName)) return true
	const val = process.env[varName]
	if (val == null || val.trim() === "") {
		console.log("MISSING ENV VAR", varName)
		allEnvPresent = false
		return false
	}
	if (isSecret(varName) && val.trim() === placeholders.get(varName)) {
		console.log("PLACEHOLDER SECRET — change before deploying:", varName)
		allEnvPresent = false
		return false
	}
	if (varName === "SECRETKEY" && val.trim().length < 32) {
		console.log("SECRETKEY TOO SHORT — must be at least 32 characters:", varName)
		allEnvPresent = false
		return false
	}
	if (typeOf(varName, placeholders.get(varName)) === "bool" && val.trim() !== "true" && val.trim() !== "false") {
		console.log("MUST BE true OR false:", varName)
		allEnvPresent = false
		return false
	}
	return true
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
	if (isServiceOff(envLines, varName)) return
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

const confirmURL = (varName) => {
	if (isServiceOff(envLines, varName)) return
	const val = process.env[varName]
	if (val == null || val.trim() === "") return
	try {
		if (!/^https?:$/.test(new URL(val).protocol)) throw new Error("scheme")
	} catch (e) {
		console.log(varName, "MUST BE A VALID http(s) URL (SPECIAL CHARACTERS MUST BE URL-ENCODED)")
		allEnvPresent = false
	}
}

schema.forEach(v => checkVar(v.key))
schema.filter(v => /_URL$/.test(v.key)).forEach(v => confirmURL(v.key))
// storage_MOTION_CONF_FILEPATH intentionally skips the filesystem path check
schema.filter(v => /_FILEPATH$/.test(v.key) && v.key !== "storage_MOTION_CONF_FILEPATH").forEach(v => confirmPath(v.key))
schema.filter(v => /_FOLDERPATH$/.test(v.key)).forEach(v => confirmPath(v.key, true))

if (multiInstance(instances) && process.env.memory_ON !== "true") {
	console.log("FORCING memory_ON=true — chimeraInstances asks for a cluster; instances coordinate through the memory socket")
	process.env.memory_ON = "true"
}

if (process.env.certbot_ON === "true" && process.env.gateway_PORT !== "80") {
	console.log("WARNING: certbot_ON=true but gateway_PORT is not 80 — Let's Encrypt HTTP-01 uses port 80; cert issuance/renewal will fail")
}

if (process.env.object_ON === "true" && process.env.livestream_ON !== "true") {
	console.log("WARNING: object_ON=true but livestream_ON is not true — object reads frames from the livestream HLS feed; new scans will fail (existing detections and captures still serve)")
}

if (process.env.schedule_ON === "true" && process.env.memory_ON !== "true") {
	console.log("WARNING: schedule_ON=true but memory_ON is not true — task configs and timers live in the memory server; /task start, list, stop and destroy will hang (/task/runs still serves)")
}

if(allEnvPresent){
	process.exit(0)
}
else{
	process.exit(1)
}
