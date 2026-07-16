var path       = require("path")
var express    = require("express")
const { helmetOptions, tracker, auth, pruneInterval } = require("lib")
const { pool } = require("./routes/lib/auth.js")
const helmet = require("helmet")

var app = express()

app.set("trust proxy", 1)

app.use(tracker)

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/command/health", require("heartbeat").heart)

app.use("/authorization", require("./routes/authorization.js"))
app.use("/cameras", auth.createAuthorize(pool), require("./routes/cameras.js"))
app.use("/res", express.static(path.join(__dirname, "../frontend/res")))
for(const webpath of ["/login", "/", "/clip", "/live", "/recordings", "/stats", "/schedule", "/admin", "/objects"]){
	app.use(webpath, express.static(path.join(__dirname, "../dist/"), {
		index: "index.html"
	}))
}

app.startDbPruning = () => pruneInterval(pool, "DELETE FROM sessions WHERE revoked = TRUE OR issued_at < NOW() - INTERVAL '30 days'")

module.exports = app