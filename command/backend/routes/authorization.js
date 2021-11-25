var express    = require("express")
var { validateBody, auth } = require("lib")

const app = express.Router()
const client = require("memory").client("AUTHORIZATION")
const {
	passwordCheck,
	login,
	pinCheck,
	generateLink,
	authorize
} = auth(client)

app.post("/login", validateBody, passwordCheck, login)
app.post("/requestLink", validateBody, pinCheck, generateLink)
app.post("/verify", authorize, (req, res) => {
	res.json({error: false })
})

module.exports = app