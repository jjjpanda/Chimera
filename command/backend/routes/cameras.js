var express = require("express")
const { loadCameras } = require("lib")

const app = express.Router()

const stripCreds = (url) => url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^@/]*@/i, "$1")

app.get("/", (req, res) => {
	res.json(loadCameras().map(c => ({ ...c, rtsp_url: stripCreds(c.rtsp_url) })))
})

module.exports = app
