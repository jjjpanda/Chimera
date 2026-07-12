var express    = require("express")

const app = express.Router()

const { ask } = require("./lib/scheduler.js")

app.get("/status", (req, res) => {
	ask("callback")((result) => {
		if (result === null) return res.status(503).send({ error: "memory unavailable" })
		res.send({})
	})
})

module.exports = app