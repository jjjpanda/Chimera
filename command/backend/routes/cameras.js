var express = require("express")
const { loadCameras } = require("lib")

const app = express.Router()

app.get("/", (req, res) => {
	res.json(loadCameras())
})

module.exports = app
