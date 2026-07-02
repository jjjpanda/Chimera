var path       = require("path")
var fs         = require("fs")
var express    = require("express")
const { auth, helmetOptions, tracker, loadCameras } = require("lib")
const pool = require("./lib/pool.js")
const helmet = require("helmet")

var app = express()

app.use(tracker)

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/livestream/health", require("heartbeat").heart)

app.use(auth.createAuthorize(pool))

app.use("/livestream", require("./routes/livestream.js"))

for (const cam of loadCameras()) {
	fs.mkdirSync(path.join(process.env.livestream_FOLDERPATH, "feed", String(cam.id)), { recursive: true })
}

module.exports = app