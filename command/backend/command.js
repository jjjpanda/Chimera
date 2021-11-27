var path       = require("path")
var express    = require("express")
const { helmetOptions } = require("lib")
const helmet = require("helmet")

var app = express()

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/command/health", require("heartbeat").heart)

app.use("/authorization", require("./routes/authorization.js"))
app.use("/res", express.static(path.join(__dirname, "../frontend/res")))
for(const webpath of ["/login", "/login/:password", "/", "/live", "/process", "/scrub", "/stats"]){
	app.use(webpath, express.static(path.join(__dirname, "../dist/"), {
		index: "app.html"
	}))
}

module.exports = app