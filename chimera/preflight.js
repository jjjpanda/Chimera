const fs = require("fs")
const path = require("path")
const readline = require("readline")
const { parseConf, buildFullUrl, urlProblem } = require("../lib/utils/loadCameras.js")
const { multiInstance, validInstances } = require("../lib/utils/multiInstance.js")
const { validTrustedSources } = require("../lib/utils/trustedSources.js")

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
		if (m) acc.push({ key: m[1], placeholder: m[2].split("#")[0].trim(), desc: m[2].split("#")[0].replace(/\*\*\*/g, "").trim(), optional: m[2].includes("***") })
		return acc
	}, [])

const typeOf = (key, placeholder) =>
	/true\s*\|\s*false/.test(placeholder) ? "bool"
		: /_PORT(_SECURE)?$/.test(key) ? "port"
			: "string"

const readLines = () => fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8").split(/\r?\n/) : []
const getVal = (lines, key) => {
	for (const l of lines) {
		const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
		if (m && m[1] === key) return m[2].split("#")[0].trim()
	}
	return undefined
}
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
	if (/^ffprobe_/.test(key)) return !on(lines, "storage")
	if (key === "storage_HOST" && on(lines, "schedule")) return false
	const prefix = key.startsWith("scheduler_") ? "schedule" : SERVICE_PREFIXES.find(s => key.startsWith(s + "_"))
	if (!prefix || key === `${prefix}_ON`) return false
	if (prefix === "memory" && multiInstance(getVal(lines, "chimeraInstances"))) return false
	return getVal(lines, `${prefix}_ON`) === "false"
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
		const probs = schema.filter(v => !isServiceOff(lines, v.key)).map(v => [v.key, varProblem(v, getVal(lines, v.key))]).filter(([, p]) => p)
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
	for (const v of schema) {
		if (isServiceOff(lines, v.key)) continue
		const p = varProblem(v, getVal(lines, v.key))
		if (!p) continue
		console.log(`\n  ${v.key} ${BAD} ${p}`)
		if (v.desc) console.log(`    ${v.desc}`)
		let val
		do {
			val = await ask(`    ${v.key} = `)
		} while (varProblem(v, val))
		setVal(lines, v.key, val)
	}
	fs.writeFileSync(ENV, lines.join("\n"))
	console.log(`.env ${OK}\n`)

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
	if (motionOk && camOk) console.log(`All checks passed ${OK}  Safe to run docker.`)
	else { console.log(`Still incomplete ${BAD}  Docker blocked.`); process.exit(1) }
}

if (require.main === module) {
	if (CHECK_ONLY) runCheck()
	else runInteractive()
}

module.exports = { parseSchema, typeOf, varProblem, cameraProblems, isServiceOff }
