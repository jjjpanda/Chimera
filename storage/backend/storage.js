var path       = require("path")
var express    = require("express")
const { auth, helmetOptions, tracker } = require("lib")
const helmet = require("helmet")
const pool = require("./lib/pool")

var app = express()

app.use(tracker)

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/storage/health", require("heartbeat").heart)

app.use(auth.createAuthorize(pool))

app.use("/", require("./routes/events.js"))
app.use("/motion", require("./routes/motion.js"))
app.use("/database", require("./routes/database.js"))

app.use("/convert", require("./routes/convert.js"))
app.use("/file", require("./routes/file.js"))
    
app.use("/shared", express.static(path.join(process.env.storage_FOLDERPATH, "shared")))

const fs = require("fs")
const imgDir = path.join(process.env.storage_FOLDERPATH, "shared/captures")
fs.readdir(imgDir, (err, files) => {
	if (!err) {
		const orphans = []
		files.forEach(file => {
			const match = file.match(/^(mp4|zip)_(.+)\.txt$/)
			if (match) {
				orphans.push({ type: match[1], id: match[2] })
				fs.unlink(path.join(imgDir, file), () => {})
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

module.exports = app