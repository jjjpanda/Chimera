const fs = require("fs")
const path = require("path")
const readline = require("readline")

let loadCameras, multiInstanceLib, trustedSourcesLib
try {
	loadCameras = require("../lib/utils/loadCameras.js")
	multiInstanceLib = require("../lib/utils/multiInstance.js")
	trustedSourcesLib = require("../lib/utils/trustedSources.js")
} catch (e) {
	if (e.code === "MODULE_NOT_FOUND") {
		console.error("Missing dependencies — run `npm install` first.")
		process.exit(1)
	}
	throw e
}
const { parseConf, buildFullUrl, urlProblem } = loadCameras
const { multiInstance, validInstances } = multiInstanceLib
const { validTrustedSources } = trustedSourcesLib

const ROOT = path.join(__dirname, "..")
const ENV = path.join(ROOT, ".env")
const ENV_EXAMPLE = path.join(ROOT, "env.example")
const MOTION = path.join(ROOT, "motion.conf")
const MOTION_EXAMPLE = path.join(ROOT, "motion.conf.example")
const CAM_DIR = path.join(ROOT, "cameraconf")

const CHECK_ONLY = process.argv.includes("--check") || (!process.stdin.isTTY && !process.argv.includes("--interactive"))
const OK = "✓", BAD = "✗"

const parseSchema = () =>
	fs.readFileSync(ENV_EXAMPLE, "utf8").split(/\r?\n/).reduce((acc, line) => {
		const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
		if (m) acc.push({ key: m[1], placeholder: m[2].split("#")[0].trim(), desc: m[2].replace(/\*\*\*/g, "").trim(), optional: m[2].includes("***") })
		return acc
	}, [])

const typeOf = (key, placeholder) =>
	/true\s*\|\s*false/.test(placeholder) ? "bool"
		: /_PORT(_SECURE)?$/.test(key) ? "port"
			: "string"

const readLines = () => fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8").split(/\r?\n/) : []
const getRaw = (lines, key) => {
	for (const l of lines) {
		const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
		if (m && m[1] === key) return m[2].trim()
	}
	return undefined
}
const getVal = (lines, key) => getRaw(lines, key)?.split("#")[0].trim()
const setVal = (lines, key, value) => {
	const idx = lines.findIndex(l => { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/); return m && m[1] === key })
	if (idx >= 0) lines[idx] = `${key} = ${value}`
	else lines.push(`${key} = ${value}`)
}

const seedEnv = () => fs.writeFileSync(ENV,
	fs.readFileSync(ENV_EXAMPLE, "utf8").split(/\r?\n/).map(line => {
		const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
		if (!m) return line
		const h = m[2].indexOf("#")
		return `${m[1]} =${h >= 0 ? " " + m[2].slice(h) : ""}`
	}).join("\n"))

const varProblem = (v, val) => {
	const blank = val === undefined || val === "" || val === v.placeholder
	if (blank) return v.optional ? null : "required, not set"
	if (v.key === "chimeraInstances" && !validInstances(val)) return `must be "max", -1, or an integer >= 0 (got "${val}")`
	if (v.key === "scheduler_TRUSTED_SOURCES" && !validTrustedSources(val)) return `must be comma-separated IPs/CIDRs or proxy-addr names like "loopback" (got "${val}")`
	if (v.key === "storage_HOST" && !/^https?:\/\//i.test(val)) return `must start with http:// or https:// — storage is dialled directly and serves plain HTTP (got "${val}")`
	const t = typeOf(v.key, v.placeholder)
	if (t === "bool" && val !== "true" && val !== "false") return `must be true or false (got "${val}")`
	if (t === "port" && !/^\d+$/.test(val)) return `must be a number (got "${val}")`
	return null
}

const getCamDir = () => {
	if (fs.existsSync(MOTION)) {
		const conf = parseConf(fs.readFileSync(MOTION, "utf8"))
		if (conf.camera_dir && !path.isAbsolute(conf.camera_dir)) return path.resolve(ROOT, conf.camera_dir)
	}
	return CAM_DIR
}
const listConfs = () => { const d = getCamDir(); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".conf")) : [] }

const cameraProblems = () => {
	const problems = []
	const ids = {}
	const names = {}
	const camDir = getCamDir()
	const confs = listConfs()
	if (!confs.length) return [`no camera .conf files in ${camDir}`]
	for (const f of confs) {
		const cam = parseConf(fs.readFileSync(path.join(camDir, f), "utf8"))
		const id = parseInt(cam.camera_id)
		if (!(id > 0)) problems.push(`${f}: camera_id must be a positive integer`)
		else if (ids[id]) problems.push(`${f}: duplicate camera_id ${id} (also in ${ids[id]})`)
		else ids[id] = f
		if (!cam.camera_name) problems.push(`${f}: camera_name not set`)
		else if (names[cam.camera_name]) problems.push(`${f}: duplicate camera_name "${cam.camera_name}" (also in ${names[cam.camera_name]})`)
		else names[cam.camera_name] = f
		if (!cam.netcam_url) problems.push(`${f}: netcam_url not set`)
		else {
			const p = urlProblem(cam.netcam_url, buildFullUrl(cam.netcam_url, cam.netcam_userpass || ""))
			if (p) problems.push(`${f}: netcam_url ${p}`)
		}
	}
	return problems
}

const camTemplate = (id, name, url, userpass) =>
	`camera_id ${id}\ncamera_name ${name}\n\nnetcam_url ${url}\nnetcam_userpass ${userpass}\nnetcam_keepalive on\nnetcam_use_tcp on\n`

const SERVICE_PREFIXES = ["command", "schedule", "storage", "livestream", "object", "memory", "gateway"]
const on = (lines, s) => getVal(lines, `${s}_ON`) === "true"
const camerasNeeded = (lines) => ["storage", "object", "livestream"].some(s => on(lines, s))
const isServiceOff = (lines, key) => {
	if (key === "storage_MOTION_CONF_FILEPATH" || /^ffmpeg_/.test(key)) return !camerasNeeded(lines)
	// object needs both: writes storage_FOLDERPATH, reads livestream_FOLDERPATH
	if (key === "storage_FOLDERPATH") return !on(lines, "storage") && !on(lines, "object")
	if (key === "livestream_FOLDERPATH") return !on(lines, "livestream") && !on(lines, "object")
	if (/^ffprobe_/.test(key)) return !on(lines, "storage")
	if (key === "storage_HOST" && on(lines, "schedule")) return false
	if (key === "scheduler_TRUSTED_SOURCES") return false
	const prefix = key.startsWith("scheduler_") ? "schedule" : SERVICE_PREFIXES.find(s => key.startsWith(s + "_"))
	if (!prefix || key === `${prefix}_ON`) return false
	if (/_HOST$/.test(key) && getVal(lines, `${prefix}_PROXY_ON`) === "true") return false
	if (prefix === "memory" && multiInstance(getVal(lines, "chimeraInstances"))) return false
	return getVal(lines, `${prefix}_ON`) === "false"
}

const objectFeedProblem = (lines) => on(lines, "object") && !on(lines, "livestream")
	? "object_ON requires livestream_ON — object's only frame source is livestream_FOLDERPATH/feed/<id>/video.m3u8, and pm2 starts the per-camera ffmpeg writers only when livestream_ON=true, so every scan fails and nothing is ever detected"
	: null

const HASH_MSG = "cannot contain # — .env is read by dotenv, which treats it as a comment and drops the rest of the line"
const answerProblem = (v, val) => val.includes("#") ? HASH_MSG : varProblem(v, val)

const hashTruncated = (lines, key) => {
	const raw = getRaw(lines, key)
	const h = raw === undefined ? -1 : raw.indexOf("#")
	return h > 0 && /\S/.test(raw[h - 1]) ? HASH_MSG : null
}
const keyProblem = (lines, v) => hashTruncated(lines, v.key) || varProblem(v, getVal(lines, v.key))

const envProblems = (schema, lines) => {
	const probs = schema.filter(v => !isServiceOff(lines, v.key)).map(v => [v.key, keyProblem(lines, v)]).filter(([, p]) => p)
	const feedProb = objectFeedProblem(lines)
	if (feedProb) probs.push(["object_ON", feedProb])
	return probs
}

const runCheck = () => {
	const schema = parseSchema()
	const lines = readLines()
	let failed = false
	console.log("Chimera pre-flight check\n")

	if (!fs.existsSync(ENV)) {
		console.log(`  .env          ${BAD}  missing`)
		failed = true
	} else {
		const probs = envProblems(schema, lines)
		console.log(`  .env          ${probs.length ? BAD : OK}${probs.length ? `  ${probs.length} problem(s)` : ""}`)
		probs.forEach(([k, p]) => console.log(`                  - ${k}: ${p}`))
		if (probs.length) failed = true
	}

	if (camerasNeeded(lines)) {
		const motionOk = fs.existsSync(MOTION)
		console.log(`  motion.conf   ${motionOk ? OK : BAD}${motionOk ? "" : "  missing"}`)
		if (!motionOk) failed = true

		const cam = cameraProblems()
		console.log(`  cameraconf/   ${cam.length ? BAD : OK}${cam.length ? `  ${cam.length} problem(s)` : ""}`)
		cam.forEach(p => console.log(`                  - ${p}`))
		if (cam.length) failed = true
	}

	if (failed) {
		console.log("\nBlocked. Run `npm run preflight` to fix interactively.")
		process.exit(1)
	}
	console.log("\nAll checks passed. Safe to run docker.")
}

const runInteractive = async () => {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
	const ask = q => new Promise(res => rl.question(q, a => res(a.trim())))
	const confirm = async (q, def = true) => {
		const a = (await ask(`${q} ${def ? "[Y/n]" : "[y/N]"} `)).toLowerCase()
		return a === "" ? def : a.startsWith("y")
	}

	console.log("Chimera pre-flight\n")

	if (!fs.existsSync(ENV)) {
		console.log("No .env found, seeding from env.example.")
		seedEnv()
	}
	const schema = parseSchema()
	const lines = readLines()
	console.log("Checking .env...")
	// answering a key can unskip an earlier one, so re-walk until nothing new
	let answered
	const asked = new Set()
	const askKey = async (v) => {
		if (v.desc) console.log(`    ${v.desc}`)
		let val, ap
		do {
			val = await ask(`    ${v.key} = `)
			ap = answerProblem(v, val)
			if (ap) console.log(`    ${BAD} ${ap}`)
		} while (ap)
		setVal(lines, v.key, val)
		asked.add(v.key)
	}
	do {
		answered = false
		for (const v of schema) {
			if (asked.has(v.key) || isServiceOff(lines, v.key)) continue
			const p = keyProblem(lines, v)
			if (!p) continue
			console.log(`\n  ${v.key} ${BAD} ${p}`)
			await askKey(v)
			answered = true
		}
		// both keys hold valid values, so the walk never re-asks them — force it
		const feedProb = objectFeedProblem(lines)
		if (feedProb) {
			console.log(`\n  object_ON ${BAD} ${feedProb}`)
			for (const key of ["livestream_ON", "object_ON"]) {
				if (!objectFeedProblem(lines)) break
				const v = schema.find(s => s.key === key)
				if (!v) continue
				asked.delete(key)
				await askKey(v)
			}
			answered = true
		}
	} while (answered)
	fs.writeFileSync(ENV, lines.join("\n"))
	const probs = envProblems(schema, lines)
	probs.forEach(([k, p]) => console.log(`\n  ${k} ${BAD} ${p}`))
	const envOk = !probs.length
	console.log(`.env ${envOk ? OK : BAD}\n`)

	const needCams = camerasNeeded(lines)
	let motionOk = true, camOk = true
	if (needCams) {
		console.log("Checking motion.conf...")
		if (!fs.existsSync(MOTION)) {
			if (await confirm("  motion.conf missing. Create from motion.conf.example?"))
				fs.copyFileSync(MOTION_EXAMPLE, MOTION)
		}
		motionOk = fs.existsSync(MOTION)
		console.log(`motion.conf ${motionOk ? OK : BAD}\n`)

		console.log("Checking cameraconf/...")
		const camDir = getCamDir()
		if (!fs.existsSync(camDir)) fs.mkdirSync(camDir, { recursive: true })
		while (cameraProblems().length) {
			for (const p of cameraProblems()) console.log(`  ${BAD} ${p}`)
			if (!(await confirm("  Add a camera now?"))) break
			const confs = listConfs().map(f => parseConf(fs.readFileSync(path.join(camDir, f), "utf8")))
			const used = confs.map(c => parseInt(c.camera_id))
			const usedNames = confs.map(c => c.camera_name)
			let id
			do { id = parseInt(await ask("    camera_id (positive integer) = ")) } while (!(id > 0) || used.includes(id))
			let name
			do { name = await ask("    camera_name = ") } while (!name || usedNames.includes(name))
			let url, userpass
			do {
				url = await ask("    netcam_url (rtsp://...) = ")
				userpass = await ask("    netcam_userpass (user:pass, blank if none) = ")
				const p = urlProblem(url, buildFullUrl(url, userpass))
				if (p) console.log(`    ${BAD} ${p}`)
			} while (urlProblem(url, buildFullUrl(url, userpass)))
			fs.writeFileSync(path.join(camDir, `cam${id}.conf`), camTemplate(id, name, url, userpass))
			console.log(`    created ${camDir}/cam${id}.conf ${OK}`)
			if (!(await confirm("  Add another camera?", false))) break
		}
		camOk = !cameraProblems().length
		console.log(`cameraconf/ ${camOk ? OK : BAD}\n`)
	}

	rl.close()
	if (motionOk && camOk && envOk) console.log(`All checks passed ${OK}  Safe to run docker.`)
	else { console.log(`Still incomplete ${BAD}  Docker blocked.`); process.exit(1) }
}

if (require.main === module) {
	if (CHECK_ONLY) runCheck()
	else runInteractive()
}

module.exports = { parseSchema, typeOf, varProblem, cameraProblems, isServiceOff, objectFeedProblem, answerProblem, envProblems, hashTruncated, runInteractive, readLines, getVal, setVal }
