var express    = require("express")
const { auth, helmetOptions } = require("lib")
const helmet = require("helmet")

var app = express()

app.use(helmet(helmetOptions))
app.use(require("cookie-parser")())

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use("/livestream/health", require("heartbeat").heart)

app.use(auth.authorize)

app.use("/livestream", require("./routes/livestream.js"))
    
module.exports = app