require("dotenv").config()
const fs = require("fs")
const path = require("path")
const { parseSchema, isServiceOff, typeOf } = require("./preflight.js")
const { multiInstance, validInstances } = require("../lib/utils/multiInstance.js")
const { validTrustedSources } = require("../lib/utils/trustedSources.js")
const gatewayHost = require("../lib/utils/gatewayHost.js")
const storageHost = require("../lib/utils/storageHost.js")

let allEnvPresent = true
const schema = parseSchema()
const optionalKeys = new Set(schema.filter(v => v.optional).map(v => v.key))
const placeholders = new Map(schema.map(v => [v.key, v.placeholder]))
const isSecret = (key) => /^SECRETKEY$|_(AUTH|TOKEN|PASSWORD)$/.test(key)

const instances = (process.env.chimeraInstances || "").trim()
if (instances !== "" && !validInstances(instances)) {
	console.log("chimeraInstances MUST BE \"max\", -1, OR AN INTEGER >= 0 — pm2 only runs cluster_mode for those; anything below -1 forks N processes that all bind the same port")
	allEnvPresent = false
}

const trustedSources = (process.env.scheduler_TRUSTED_SOURCES || "").trim()
if (trustedSources !== "" && !validTrustedSources(trustedSources)) {
	console.log("scheduler_TRUSTED_SOURCES MUST BE COMMA-SEPARATED IPs/CIDRs OR proxy-addr NAMES LIKE \"loopback\" — proxy-addr.compile throws at import and crash-loops every service")
	allEnvPresent = false
}

const envLines = Object.entries(process.env).map(([k, v]) => `${k} = ${v}`)

const rawStorageHost = (process.env.storage_HOST || "").trim()
if (!isServiceOff(envLines, "storage_HOST") && rawStorageHost !== "" && !/^https?:\/\//i.test(rawStorageHost)) {
	console.log("storage_HOST MUST START WITH http:// OR https:// — scheduled tasks and the gateway proxy dial it directly and storage only ever serves plain HTTP, so an implied https:// fails the TLS handshake on every request")
	allEnvPresent = false
}

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

const LOOPBACK = ["localhost", "127.0.0.1", "::1", "[::1]"]
const originOf = (url) => { try { return new URL(url).host } catch { return "" } }
const hostnameOf = (url) => { try { return new URL(url).hostname } catch { return "" } }

const gwHost = hostnameOf(gatewayHost()) || (process.env.gateway_HOST || "").trim()
if (gwHost && !LOOPBACK.includes(gwHost) && process.env.command_COOKIE_SECURE !== "true") {
	console.log("WARNING: auth cookie may be sent over plaintext HTTP — set command_COOKIE_SECURE=true for a non-loopback gateway_HOST reached over HTTPS (leave false only for plain-HTTP deploys)")
}

const scheduleOn = process.env.schedule_ON === "true"
const gwOrigin = originOf(gatewayHost())
const stOrigin = originOf(storageHost())
const stHostname = hostnameOf(storageHost())
if (scheduleOn && gwOrigin && gwOrigin === stOrigin) {
	console.log("WARNING: storage_HOST points at gateway_HOST — the gateway strips Authorization on every proxied request, so scheduled tasks 401 whatever scheduler_TRUSTED_SOURCES says; point storage_HOST straight at the storage service")
}
else if (scheduleOn && stHostname && !LOOPBACK.includes(stHostname) && trustedSources === "") {
	console.log("WARNING: storage_HOST is not loopback but scheduler_TRUSTED_SOURCES is unset — storage trusts only loopback peers by default, so every scheduled task 401s with nothing but a webhook alert; set scheduler_TRUSTED_SOURCES to the address/CIDR the schedule service connects from")
}

if(allEnvPresent){
	process.exit(0)
}
else{
	process.exit(1)
}
