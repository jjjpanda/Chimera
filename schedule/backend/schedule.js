var express    = require("express")
const { auth, helmetOptions, tracker } = require("lib")
const helmet = require("helmet")

var app = express()

app.use(tracker)

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/schedule/health", require("heartbeat").heart)

app.use(auth.authorize)

app.use("/memory", require("./routes/memory.js"))
app.use("/task", require("./routes/task.js"))

module.exports = app