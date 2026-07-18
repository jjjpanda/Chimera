var express    = require("express")
const { auth, helmetOptions, tracker } = require("lib")
const helmet = require("helmet")
const memory = require("memory")
const pool = require("./lib/pool")

var app = express()

app.set("trust proxy", 1)

app.use(tracker)

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/schedule/health", require("heartbeat").heart)

app.use(auth.createAuthorize(pool))
if (process.env.memory_ON == "true") auth.connectSessionSync(memory.client("AUTH"))

app.use("/memory", require("./routes/memory.js"))
app.use("/task", require("./routes/task.js"))

module.exports = app