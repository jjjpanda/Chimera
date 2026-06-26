require("dotenv").config()
const { loadCameras } = require("lib")
const pool = require("./backend/lib/pool.js")

const buildMapping = () => {
	let names
	try { names = JSON.parse(process.env.cameras || "[]") } catch (e) { names = [] }
	const conf = loadCameras()
	const map = []
	names.forEach((name, i) => {
		const cam = conf.find(c => c.name === name)
		if (cam) map.push({ feed: i + 1, id: cam.id })
	})
	return map
}

const migrate = async () => {
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
