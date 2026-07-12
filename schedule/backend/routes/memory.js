var express    = require("express")

const app = express.Router()

const client = require("memory").client("MEMORY-HEALTH")

app.get("/status", (req, res) => {
	client.timeout(2000).emit("callback", (err) => {
		if (err) return res.status(503).send({ error: "memory unavailable" })
		res.send({})
	})
})

module.exports = app