var express    = require("express")
var { validateBody, auth } = require("lib")
const { authorize } = auth
const {
	passwordCheck,
	login,
	pinCheck,
	generateLink
} = require("./lib/auth.js")

const app = express.Router()

app.post("/login", validateBody, passwordCheck, login)
app.post("/requestLink", validateBody, pinCheck, generateLink)
app.post("/verify", authorize, (req, res) => {
	res.json({error: false })
})

module.exports = app