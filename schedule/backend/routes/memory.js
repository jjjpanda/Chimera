var express    = require("express")

const app = express.Router()

const client = require("memory").client("MEMORY-HEALTH")

app.get("/status", (req, res) => {
	client.emit("callback", () => {
		res.send({})
	})
})

module.exports = app