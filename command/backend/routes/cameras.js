var express = require("express")
const { loadCameras } = require("lib")

const app = express.Router()

app.get("/", async (req, res) => {
	try {
		res.json((await loadCameras()).map(({ id, name }) => ({ id, name })))
	} catch (e) {
		res.status(500).json({ error: true })
	}
})

module.exports = app
