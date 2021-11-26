var express    = require("express")
var { validateBody, auth } = require("lib")
const {
	passwordCheck,
	login,
	pinCheck,
	generateLink,
	authorize
} = auth

const app = express.Router()

const client = require("memory").client("AUTHORIZATION")

app.post("/login", validateBody, passwordCheck(client), login)
app.post("/requestLink", validateBody, pinCheck, generateLink(client))
app.post("/verify", authorize, (req, res) => {
	res.json({error: false })
})

module.exports = app