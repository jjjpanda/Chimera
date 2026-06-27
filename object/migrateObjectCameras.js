require("dotenv").config()
const { loadCameras } = require("lib")
const pool = require("./backend/lib/pool.js")

const normalize = s => s.toLowerCase().replace(/\s+/g, "_")

const buildMapping = () => {
	let names
	try { names = JSON.parse(process.argv[2] || process.env.cameras || "[]") } catch (e) { names = [] }
	const conf = loadCameras()
	const map = []
	names.forEach((name, i) => {
		const cam = conf.find(c => normalize(c.name) === normalize(name))
		if (cam) map.push({ feed: i + 1, id: cam.id })
		else console.warn(`no match for camera "${name}" (feed ${i + 1})`)
	})
	return map
}

const migrate = async () => {
	if (!process.argv[2] && !process.env.cameras) {
		console.error("pass old camera names as JSON array: node migrateObjectCameras.js '[\"cam1\",\"cam2\"]'")
		process.exit(1)
	}
	await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`)
	const { rowCount: inserted } = await pool.query(`INSERT INTO _migrations (name) VALUES ('migrateObjectCameras') ON CONFLICT DO NOTHING`)
	if (inserted === 0) {
		console.log("migration already applied")
		return 0
	}
	const map = buildMapping()
	if (!map.length) {
		console.log("no camera mapping resolved; nothing to migrate")
		return 0
	}
	const cases = map.map(m => `WHEN ${m.feed} THEN ${m.id}`).join(" ")
	const feeds = map.map(m => m.feed).join(",")
	const { rowCount } = await pool.query(
		`UPDATE objects_detected SET camera = CASE camera ${cases} ELSE camera END WHERE camera IN (${feeds});`
	)
	console.log(`remapped ${rowCount} detection row(s) from feed index to camera_id`)
	return rowCount
}

module.exports = { buildMapping, migrate }

if (require.main === module) {
	migrate().then(() => pool.end()).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
}
