var path       = require("path")
var express    = require("express")
const { auth, helmetOptions, tracker } = require("lib")
const helmet = require("helmet")

var app = express()

app.use(tracker)

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/storage/health", require("heartbeat").heart)

app.use(auth.authorize)

app.use("/motion", require("./routes/motion.js"))

app.use("/convert", require("./routes/convert.js"))
app.use("/file", require("./routes/file.js"))
    
app.use("/shared", express.static(path.join(process.env.storage_FOLDERPATH, "shared")))

module.exports = app