var express = require("express")
const { loadCameras } = require("lib")

const app = express.Router()
const cameras = loadCameras()

app.get("/", (req, res) => {
	res.json(cameras)
})

module.exports = app
