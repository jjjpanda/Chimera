var path       = require("path")
var express    = require("express")
const { auth, helmetOptions, tracker, pruneInterval, schedulableUrls, isPrimeInstance } = require("lib")
const helmet = require("helmet")
const memory = require("memory")
const { pool } = require("./lib/pool")

var app = express()

app.set("trust proxy", 1)

app.use(tracker)

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/storage/health", require("heartbeat").heart)

app.use(auth.createAuthorize(pool, { schedulableUrls }))
if (process.env.memory_ON == "true") auth.connectSessionSync(memory.client("AUTH"))

app.use("/", require("./routes/events.js"))
app.use("/motion", require("./routes/motion.js"))
app.use("/database", require("./routes/database.js"))

app.use("/convert", require("./routes/convert.js"))
app.use("/file", require("./routes/file.js"))
    
app.use("/shared", express.static(path.join(process.env.storage_FOLDERPATH, "shared")))

const fs = require("fs")
const { EXPORT_LOCK_PATTERN, sweepOrphanFrames } = require("./routes/lib/file.js")
const imgDir = path.join(process.env.storage_FOLDERPATH, "shared/captures")
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000
const ORPHAN_SWEEP_MS = 30 * 60 * 1000
const FRAME_SWEEP_MS = 60 * 60 * 1000
try { fs.mkdirSync(imgDir, { recursive: true }) } catch (e) { console.error("❌ Failed to create storage directory:", e.message) }
const sweepOrphanLocks = () => fs.readdir(imgDir, (err, files) => {
	if (!err) {
		const orphans = []
		files.forEach(file => {
			const match = file.match(EXPORT_LOCK_PATTERN)
			if (match) {
				const lockPath = path.join(imgDir, file)
				let stat
				try { stat = fs.statSync(lockPath) } catch { return }
				if (Date.now() - stat.mtimeMs < ORPHAN_AGE_MS) return
				orphans.push({ type: match[1], id: match[3] })
				fs.unlink(lockPath, () => {})
			}
		})
		files.forEach(file => {
			orphans.forEach(({ type, id }) => {
				if (file.startsWith("output_") && file.endsWith(`_${id}.${type}`)) {
					fs.unlink(path.join(imgDir, file), () => {})
				}
			})
		})
	}
})
sweepOrphanLocks()
setInterval(sweepOrphanLocks, ORPHAN_SWEEP_MS).unref()

const sweepFrames = () => sweepOrphanFrames().catch((e) => console.log("STORAGE FRAME SWEEP FAILED", e.message))
if (isPrimeInstance) {
	sweepFrames()
	setInterval(sweepFrames, FRAME_SWEEP_MS).unref()
}

app.startDbPruning = () => pruneInterval(pool, "DELETE FROM frame_deletes WHERE timestamp < NOW() - INTERVAL '30 days'")

module.exports = app