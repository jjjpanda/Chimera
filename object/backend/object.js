var express = require("express")
const { auth, helmetOptions, tracker } = require("lib")
const helmet = require("helmet")
const pool = require("./lib/pool.js")

var app = express()

app.use(tracker)

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/object/health", require("heartbeat").heart)

app.use(auth.createAuthorize(pool))

app.use("/object", require("./routes/object.js"))

module.exports = app
