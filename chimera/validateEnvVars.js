require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { parseSchema, isServiceOff, typeOf } = require("./preflight.js")

let allEnvPresent = true
const schema = parseSchema()
const optionalKeys = new Set(schema.filter(v => v.optional).map(v => v.key))
const placeholders = new Map(schema.map(v => [v.key, v.placeholder]))
const isSecret = (key) => /^SECRETKEY$|_(AUTH|TOKEN|PASSWORD)$/.test(key)
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

if(allEnvPresent){
	process.exit(0)
}
else{
	process.exit(1)
}
